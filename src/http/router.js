// Tiny HTTP Router supporting parameterized routes (:param).
// Operates without any external frameworks or dependencies.

import { DomainError } from '../domain/errors.js';

export class Router {
  #routes = [];

  /**
   * Registers a route for a given HTTP method and path pattern.
   * @param {string} method
   * @param {string} path
   * @param {Function} handler
   */
  add(method, path, handler) {
    if (typeof method !== 'string' || !method.trim()) {
      throw new TypeError('Route method must be a non-empty string');
    }
    if (typeof path !== 'string' || !path.startsWith('/')) {
      throw new TypeError('Route path must start with a leading slash ("/")');
    }
    if (typeof handler !== 'function') {
      throw new TypeError('Route handler must be a function');
    }

    const segments = path.split('/').slice(1);
    this.#routes.push({
      method: method.toUpperCase(),
      path,
      segments,
      handler,
    });
    return this;
  }

  get(path, handler) {
    return this.add('GET', path, handler);
  }

  post(path, handler) {
    return this.add('POST', path, handler);
  }

  delete(path, handler) {
    return this.add('DELETE', path, handler);
  }

  put(path, handler) {
    return this.add('PUT', path, handler);
  }

  /**
   * Matches an incoming HTTP method and path against registered routes.
   * @param {string} method
   * @param {string} pathname
   * @returns {{ handler: Function, params: Record<string, string> } | null}
   */
  match(method, pathname) {
    const targetMethod = method.toUpperCase();
    const reqSegments = pathname.split('/').slice(1);

    for (const route of this.#routes) {
      if (route.method !== targetMethod || route.segments.length !== reqSegments.length) {
        continue;
      }

      const params = {};
      let isMatch = true;

      for (let i = 0; i < route.segments.length; i++) {
        const patternPart = route.segments[i];
        const actualPart = reqSegments[i];

        if (patternPart.startsWith(':')) {
          if (!actualPart) {
            isMatch = false;
            break;
          }
          try {
            params[patternPart.slice(1)] = decodeURIComponent(actualPart);
          } catch {
            throw new DomainError('INVALID_PATH', 'The request path is invalid');
          }
        } else if (patternPart !== actualPart) {
          isMatch = false;
          break;
        }
      }

      if (isMatch) {
        return { handler: route.handler, params };
      }
    }

    return null;
  }
}
