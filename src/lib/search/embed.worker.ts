/**
 * Runs the embedding model off the main thread, so typing never stutters.
 *
 * An embedding turns a sentence into 384 numbers that capture its meaning:
 * "the job hunt" and "Applied to Lumen Labs" end up close together even though
 * they share no words. The model (bge-small-en-v1.5, open source, ~34 MB, made
 * for search) is downloaded once from Hugging Face and cached by the browser;
 * after that it runs entirely on your device.
 */

import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

env.allowLocalModels = false;

const MODEL = "Xenova/bge-small-en-v1.5";
// bge models are trained with this prefix on questions (not on documents).
const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";

// pipeline()'s full type is a union of every task it supports - too big for
// TypeScript to check - so we narrow it to the one task we use.
const featureExtraction = pipeline as unknown as (task: "feature-extraction", model: string, options: { dtype: string }) => Promise<FeatureExtractionPipeline>;

let extractor: Promise<FeatureExtractionPipeline> | null = null;
const load = () => (extractor ??= featureExtraction("feature-extraction", MODEL, { dtype: "q8" }));

self.onmessage = async (event: MessageEvent<{ id: number; texts: string[]; kind: "query" | "doc" }>) => {
  const { id, texts, kind } = event.data;
  try {
    const model = await load();
    const input = kind === "query" ? texts.map((t) => QUERY_PREFIX + t) : texts;
    const output = await model(input, { pooling: "cls", normalize: true });
    const [n, dim] = output.dims as [number, number];
    const data = output.data as Float32Array;
    const vectors = Array.from({ length: n }, (_, i) => data.slice(i * dim, (i + 1) * dim));
    self.postMessage({ id, vectors });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
