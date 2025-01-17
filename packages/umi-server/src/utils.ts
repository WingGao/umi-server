import ssrPolyfill from 'ssr-polyfill';
import { parse } from 'url';
import { load } from 'cheerio';
import _log from './debug';
import { IHandler } from './index';

export const _getDocumentHandler = (html: string, option: object = {}): ReturnType<typeof load> => {
  const docTypeHtml = /^<!DOCTYPE html>/.test(html) ? html : `<!DOCTYPE html>${html}`
  return load(docTypeHtml, {
    decodeEntities: false,
    recognizeSelfClosing: true,
    ...option,
  });
};

declare var global: {
  [key: string]: any;
};

export const injectChunkMaps: IHandler = ($, args) => {
  const { chunkMap } = args;
  _log('injectChunkMaps', chunkMap);
  const { js = [], css = [] } = chunkMap || {};
  const umiJS = js.find(script => /^umi\.(\w+\.)?js$/g.test(script));
  // publicPath get from umi.js(gen from umi)
  const umiSrc = $(`script[src*="${umiJS}"]`).attr('src')
  const publicPath = umiSrc ? umiSrc.replace(umiJS, '') : '/';
  // filter umi.css and umi.*.css, htmlMap have includes
  const styles = css.filter(style => !/^umi\.(\w+\.)?css$/g.test(style)) || [];

  styles.forEach(style => {
    $('head').append(`<link rel="stylesheet" href="${publicPath}${style}" />`);
  });
  // filter umi.js and umi.*.js
  const scripts = js.filter(script => !/^umi([.\w]*)?\.js$/g.test(script)) || [];

  scripts.forEach(script => {
    $('head').append(`<link rel="preload" href="${publicPath}${script}" as="script"/>`);
  });

  return $;
};

export type INodePolyfillDecorator = (
  enable: boolean,
  url?: string,
) => (url?: string, context?: {}) => void;

export const nodePolyfillDecorator: INodePolyfillDecorator = (
  enable = false,
  origin = 'http://localhost',
) => {
  // init
  global.window = {};
  if (enable) {
    const mockWin = ssrPolyfill({
      url: origin,
    });
    const mountGlobal = ['document', 'location', 'navigator', 'Image', 'self'];
    mountGlobal.forEach(mount => {
      global[mount] = mockWin[mount];
    });

    global.window = mockWin;

    // using window.document, window.location to mock document, location
    mountGlobal.forEach(mount => {
      global[mount] = mockWin[mount];
    });

    // if use pathname to mock location.pathname
    return (nextOrigin) => {
      const { protocol, host } = parse(origin);
      const nextUrl = /^https?:\/\//.test(nextOrigin) ? nextOrigin : `${protocol}//${host}`;
      const nextObj = parse(nextUrl);
      Object.defineProperty(window, 'location', {
        writable: true,
        value: nextObj,
      });
    };
  }
  return () => {
    // noop
  };
};
