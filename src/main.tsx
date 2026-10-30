import { createRoot } from "react-dom/client";
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import App from "./App.tsx";
import "./index.css";

// Global error capture for local diagnostic logging
window.onerror = (message, source, lineno, colno, error) => {
  const errorObj = {
    type: 'onerror',
    message: String(message),
    source: String(source),
    line: lineno,
    col: colno,
    stack: error?.stack || null,
    time: new Date().toISOString()
  };
  localStorage.setItem('last_js_error', JSON.stringify(errorObj));
  console.error('Captured global error:', errorObj);
};

window.onunhandledrejection = (event) => {
  const errorObj = {
    type: 'unhandledrejection',
    message: String(event.reason?.message || event.reason),
    stack: event.reason?.stack || null,
    time: new Date().toISOString()
  };
  localStorage.setItem('last_js_error', JSON.stringify(errorObj));
  console.error('Captured unhandled rejection:', errorObj);
};

createRoot(document.getElementById("root")!).render(<App />);

