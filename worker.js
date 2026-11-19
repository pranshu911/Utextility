importScripts("engine.js");

self.onmessage = ({ data }) => self.postMessage(ProofTools.evaluateJob(data));
