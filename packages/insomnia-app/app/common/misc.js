// @flow
import * as electron from 'electron';
import { Readable, Writable } from 'stream';
import fuzzysort from 'fuzzysort';
import * as uuid from 'uuid';
import zlib from 'zlib';
import { join as pathJoin } from 'path';
import { METHOD_OPTIONS, METHOD_DELETE, DEBOUNCE_MILLIS } from './constants';

const ESCAPE_REGEX_MATCH = /[-[\]/{}()*+?.\\^$|]/g;

type Header = {
  name: string,
  value: string,
};

type Parameter = {
  name: string,
  value: string,
};

export function filterParameters<T: Parameter>(parameters: Array<T>, name: string): Array<T> {
  if (!Array.isArray(parameters) || !name) {
    return [];
  }

  return parameters.filter(h => (!h || !h.name ? false : h.name === name));
}

export function filterHeaders<T: Header>(headers: Array<T>, name: string): Array<T> {
  if (!Array.isArray(headers) || !name || !(typeof name === 'string')) {
    return [];
  }

  return headers.filter(h => {
    // Never match against invalid headers
    if (!h || !h.name || typeof h.name !== 'string') {
      return false;
    }

    return h.name.toLowerCase() === name.toLowerCase();
  });
}

export function hasContentTypeHeader<T: Header>(headers: Array<T>): boolean {
  return filterHeaders(headers, 'content-type').length > 0;
}

export function hasContentLengthHeader<T: Header>(headers: Array<T>): boolean {
  return filterHeaders(headers, 'content-length').length > 0;
}

export function hasAuthHeader<T: Header>(headers: Array<T>): boolean {
  return filterHeaders(headers, 'authorization').length > 0;
}

export function hasAcceptHeader<T: Header>(headers: Array<T>): boolean {
  return filterHeaders(headers, 'accept').length > 0;
}

export function hasUserAgentHeader<T: Header>(headers: Array<T>): boolean {
  return filterHeaders(headers, 'user-agent').length > 0;
}

export function hasAcceptEncodingHeader<T: Header>(headers: Array<T>): boolean {
  return filterHeaders(headers, 'accept-encoding').length > 0;
}

export function getSetCookieHeaders<T: Header>(headers: Array<T>): Array<T> {
  return filterHeaders(headers, 'set-cookie');
}

export function getLocationHeader<T: Header>(headers: Array<T>): T | null {
  const matches = filterHeaders(headers, 'location');
  return matches.length ? matches[0] : null;
}

export function getContentTypeHeader<T: Header>(headers: Array<T>): T | null {
  const matches = filterHeaders(headers, 'content-type');
  return matches.length ? matches[0] : null;
}

export function getMethodOverrideHeader<T: Header>(headers: Array<T>): T | null {
  const matches = filterHeaders(headers, 'x-http-method-override');
  return matches.length ? matches[0] : null;
}

export function getHostHeader<T: Header>(headers: Array<T>): T | null {
  const matches = filterHeaders(headers, 'host');
  return matches.length ? matches[0] : null;
}

export function getContentDispositionHeader<T: Header>(headers: Array<T>): T | null {
  const matches = filterHeaders(headers, 'content-disposition');
  return matches.length ? matches[0] : null;
}

export function getContentLengthHeader<T: Header>(headers: Array<T>): T | null {
  const matches = filterHeaders(headers, 'content-length');
  return matches.length ? matches[0] : null;
}

/**
 * Generate an ID of the format "<MODEL_NAME>_<TIMESTAMP><RANDOM>"
 * @param prefix
 * @returns {string}
 */
export function generateId(prefix: string): string {
  const id = uuid.v4().replace(/-/g, '');

  if (prefix) {
    return `${prefix}_${id}`;
  } else {
    return id;
  }
}

export function delay(milliseconds: number = DEBOUNCE_MILLIS): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export function removeVowels(str: string): string {
  return str.replace(/[aeiouyAEIOUY]/g, '');
}

export function formatMethodName(method: string): string {
  let methodName = method || '';
  if (method === METHOD_DELETE || method === METHOD_OPTIONS) {
    methodName = method.slice(0, 3);
  } else if (method.length > 4) {
    methodName = removeVowels(method).slice(0, 4);
  }
  return methodName;
}

export function keyedDebounce(callback: Function, millis: number = DEBOUNCE_MILLIS): Function {
  let timeout;
  let results = {};

  return function(key, ...args) {
    results[key] = args;

    clearTimeout(timeout);
    timeout = setTimeout(() => {
      if (!Object.keys(results).length) {
        return;
      }

      callback(results);
      results = {};
    }, millis);
  };
}

export function debounce(callback: Function, millis: number = DEBOUNCE_MILLIS): Function {
  // For regular debounce, just use a keyed debounce with a fixed key
  return keyedDebounce(results => {
    callback.apply(null, results.__key__);
  }, millis).bind(null, '__key__');
}

export function describeByteSize(bytes: number, long: boolean = false): string {
  bytes = Math.round(bytes * 10) / 10;
  let size;

  // NOTE: We multiply these by 2 so we don't end up with
  // values like 0 GB

  let unit;
  if (bytes < 1024 * 2) {
    size = bytes;
    unit = long ? 'bytes' : 'B';
  } else if (bytes < 1024 * 1024 * 2) {
    size = bytes / 1024;
    unit = long ? 'kilobytes' : 'KB';
  } else if (bytes < 1024 * 1024 * 1024 * 2) {
    size = bytes / 1024 / 1024;
    unit = long ? 'megabytes' : 'MB';
  } else {
    size = bytes / 1024 / 1024 / 1024;
    unit = long ? 'gigabytes' : 'GB';
  }

  const rounded = Math.round(size * 10) / 10;
  return `${rounded} ${unit}`;
}

export function nullFn(): void {
  // Do nothing
}

export function preventDefault(e: Event): void {
  e.preventDefault();
}

export function clickLink(href: string): void {
  electron.shell.openExternal(href);
}

export function fnOrString(v: string | Function, ...args: Array<any>) {
  if (typeof v === 'string') {
    return v;
  } else {
    return v(...args);
  }
}

export function compressObject(obj: any): string {
  const compressed = zlib.gzipSync(JSON.stringify(obj));
  return compressed.toString('base64');
}

export function decompressObject(input: string | null): any {
  if (typeof input !== 'string') {
    return null;
  }

  const jsonBuffer = zlib.gunzipSync(Buffer.from(input, 'base64'));
  return JSON.parse(jsonBuffer.toString('utf8'));
}

export function resolveHomePath(p: string): string {
  if (p.indexOf('~/') === 0) {
    return pathJoin(process.env.HOME || '/', p.slice(1));
  } else {
    return p;
  }
}

export function jsonParseOr(str: string, fallback: any): any {
  try {
    return JSON.parse(str);
  } catch (err) {
    return fallback;
  }
}

export function escapeHTML(unsafeText: string): string {
  const div = document.createElement('div');
  div.innerText = unsafeText;
  return div.innerHTML;
}

/**
 * Escape a dynamic string for use inside of a regular expression
 * @param str - string to escape
 * @returns {string} escaped string
 */
export function escapeRegex(str: string): string {
  return str.replace(ESCAPE_REGEX_MATCH, '\\$&');
}

export function fuzzyMatch(
  searchString: string,
  text: string,
  options: { splitSpace?: boolean, loose?: boolean } = {},
): null | { score: number, indexes: Array<number> } {
  return fuzzyMatchAll(searchString, [text], options);
}

export function fuzzyMatchAll(
  searchString: string,
  allText: Array<string>,
  options: { splitSpace?: boolean, loose?: boolean } = {},
): null | { score: number, indexes: Array<number> } {
  if (!searchString || !searchString.trim()) {
    return null;
  }

  const words = searchString.split(' ').filter(w => w.trim());
  const terms = options.splitSpace ? [...words, searchString] : [searchString];

  let maxScore = null;
  let indexes = [];
  let termsMatched = 0;
  for (const term of terms) {
    let matchedTerm = false;
    for (const text of allText.filter(t => !t || t.trim())) {
      const result = fuzzysort.single(term, text);
      if (!result) {
        continue;
      }

      // Don't match garbage
      if (result.score < -8000) {
        continue;
      }

      if (maxScore === null || result.score > maxScore) {
        maxScore = result.score;
      }

      indexes = [...indexes, ...result.indexes];
      matchedTerm = true;
    }

    if (matchedTerm) {
      termsMatched++;
    }
  }

  // Make sure we match all provided terms except the last (full) one
  if (!options.loose && termsMatched < terms.length - 1) {
    return null;
  }

  if (maxScore === null) {
    return null;
  }

  return {
    score: maxScore,
    indexes,
    target: allText.join(' '),
  };
}

export function getViewportSize(): string | null {
  const { BrowserWindow } = electron.remote || electron;
  const w = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];

  if (w) {
    const { width, height } = w.getContentBounds();
    return `${width}x${height}`;
  } else {
    // No windows open
    return null;
  }
}

export function getScreenResolution(): string {
  const { screen } = electron.remote || electron;
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return `${width}x${height}`;
}

export function getUserLanguage(): string {
  const { app } = electron.remote || electron;
  return app.getLocale();
}

export async function waitForStreamToFinish(s: Readable | Writable): Promise<void> {
  return new Promise(resolve => {
    if ((s: any)._readableState && (s: any)._readableState.finished) {
      return resolve();
    }

    if ((s: any)._writableState && (s: any)._writableState.finished) {
      return resolve();
    }

    s.on('close', () => {
      resolve();
    });

    s.on('error', () => {
      resolve();
    });
  });
}

export function getDesignerDataDir(): string {
  const { app } = electron.remote || electron;
  return process.env.DESIGNER_DATA_PATH || pathJoin(app.getPath('appData'), 'Insomnia Designer');
}

export function getDataDirectory(): string {
  const { app } = electron.remote || electron;
  return process.env.INSOMNIA_DATA_PATH || app.getPath('userData');
}

export function chunkArray<T>(arr: Array<T>, chunkSize: number): Array<Array<T>> {
  const chunks = [];
  for (let i = 0, j = arr.length; i < j; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize));
  }

  return chunks;
}

export function pluralize(text: string): string {
  let trailer = 's';
  let chop = 0;

  // Things already ending with 's' stay that way
  if (text.match(/s$/)) {
    trailer = '';
    chop = 0;
  }

  // Things ending in 'y' convert to ies
  if (text.match(/y$/)) {
    trailer = 'ies';
    chop = 1;
  }

  // Add the trailer for pluralization
  return `${text.slice(0, text.length - chop)}${trailer}`;
}

export function diffPatchObj(baseObj: {}, patchObj: {}, deep = false): ObjectComparison {
  const clonedBaseObj = JSON.parse(JSON.stringify(baseObj));

  for (const prop in baseObj) {
    if (!Object.prototype.hasOwnProperty.call(baseObj, prop)) {
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(patchObj, prop)) {
      const left = baseObj[prop];
      const right = patchObj[prop];

      if (right !== left) {
        if (deep && isObject(left) && isObject(right)) {
          clonedBaseObj[prop] = diffPatchObj(left, right, deep);
        } else if (isObject(left) && !isObject(right)) {
          // when right is empty but left isn't, prefer left to avoid a sparse array
          clonedBaseObj[prop] = left;
        } else {
          // otherwise prefer right when both elements aren't objects to ensure values don't get overwritten
          clonedBaseObj[prop] = right;
        }
      }
    }
  }

  for (const prop in patchObj) {
    if (!Object.prototype.hasOwnProperty.call(patchObj, prop)) {
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(baseObj, prop)) {
      clonedBaseObj[prop] = patchObj[prop];
    }
  }

  return clonedBaseObj;
}

export function isObject(obj: any) {
  return obj !== null && typeof obj === 'object';
}
