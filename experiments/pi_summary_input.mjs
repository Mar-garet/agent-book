/** Observe Pi's real pre-summary serializer; no summary model is called. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  'source-root': { type: 'string', default: resolve(dirname(fileURLToPath(import.meta.url)), '..') },
  output: { type: 'string' },
} });
const root = resolve(values['source-root']);
const manifest = JSON.parse(await readFile(resolve(root, 'SOURCES.json'), 'utf8'));
const expected = manifest.repositories.find(item => item.directory === 'pi').commit;
const actual = execFileSync('git', ['-C', resolve(root, 'pi'), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(actual, expected);
const serializerPath = 'pi/packages/coding-agent/src/core/compaction/utils.ts';
const textPath = 'pi/packages/ai/src/utils/text.ts';
const serializerURL = pathToFileURL(resolve(root, serializerPath)).href;
const textURL = pathToFileURL(resolve(root, textPath)).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    // The package's own index re-exports this exact function. Load its real
    // source module directly, without importing model providers or any stubs.
    if (specifier === '@earendil-works/pi-ai' && context.parentURL === serializerURL) {
      return { url: textURL, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const { serializeConversation } = await import(serializerURL);
const marker = 'ONLY_TEST_ENVIRONMENT';
const toolResult = (id, text) => ({
  role: 'toolResult', toolCallId: id, toolName: 'read',
  content: [{ type: 'text', text }], isError: false, timestamp: 0,
});
const definitions = [
  { case: 'tool_fact_at_end', messages: [toolResult('tail', 'x'.repeat(2200) + marker)], expected: 0 },
  { case: 'tool_fact_at_start', messages: [toolResult('head', marker + 'x'.repeat(2200))], expected: 1 },
  { case: 'user_fact_at_end', messages: [{
    role: 'user', content: [{ type: 'text', text: 'x'.repeat(2200) + marker }], timestamp: 0,
  }], expected: 1 },
  { case: 'limit_is_per_tool_result', messages: [
    toolResult('part-a', 'x'.repeat(1500) + marker),
    toolResult('part-b', 'x'.repeat(1500) + marker),
  ], expected: 2 },
];
const cases = definitions.map(({ case: name, messages, expected: count }) => {
  const serialized = serializeConversation(messages);
  const observed = serialized.split(marker).length - 1;
  assert.equal(observed, count, name);
  return {
    case: name, input: messages, marker,
    marker_count_in_original: JSON.stringify(messages).split(marker).length - 1,
    marker_count_in_summary_request: observed,
    serialized_characters: serialized.length,
    truncation_marker_present: serialized.includes('more characters truncated'),
    serialized,
  };
});
const hash = async path => createHash('sha256').update(await readFile(path)).digest('hex');
const report = {
  experiment: 'pi-summary-input', recorded_at: new Date().toISOString(),
  node: process.version, platform: `${process.platform}-${process.arch}`, model_calls: 0,
  execution_scope: 'Real fixed Pi serializeConversation and contentText modules, synthetic messages only',
  import_resolution: 'One package re-export is resolved to its original source module; no function is replaced',
  source_commits: { pi: actual },
  source_file_sha256: {
    [serializerPath]: await hash(resolve(root, serializerPath)),
    [textPath]: await hash(resolve(root, textPath)),
  },
  script_sha256: await hash(fileURLToPath(import.meta.url)), cases,
};
const encoded = JSON.stringify(report, null, 2) + '\n';
if (values.output) {
  await mkdir(dirname(resolve(values.output)), { recursive: true });
  await writeFile(values.output, encoded);
}
process.stdout.write(encoded);
