// A module worker keeps Python computation off the interface thread.
// Python and React share results through JSON, not duplicated statistical logic.
import { loadPyodide } from 'https://cdn.jsdelivr.net/pyodide/v314.0.8/full/pyodide.mjs';

let runtime;
let dispatch;
const ready = (async () => {
  self.postMessage({ type: 'status', message: 'Loading Python…' });
  runtime = await loadPyodide();
  const response = await fetch(new URL('./python/engine.py', import.meta.url));
  if (!response.ok) throw new Error(`Cannot load the Python engine (${response.status}).`);
  await runtime.runPythonAsync(await response.text());
  dispatch = runtime.globals.get('dispatch_json');
  self.postMessage({ type: 'ready' });
})();
ready.catch(error => self.postMessage({ type: 'fatal', message: error.message }));

// Queue requests in order, even if they arrive while Python is loading.
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue.then(async () => {
    try {
      await ready;
      const result = JSON.parse(dispatch(JSON.stringify(data.request)));
      self.postMessage({ type: 'result', id: data.id, result });
    } catch (error) {
      self.postMessage({ type: 'error', id: data.id, message: error.message });
    }
  });
};
