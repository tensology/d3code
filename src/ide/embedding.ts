/** Keep embedded requests and browser history inside the authorised workspace. */
export function embeddedClientScript(basePath: string, storageScope: string): string {
  if (basePath && !/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+$/.test(basePath)) {
    throw new Error("D3CODE_BASE_PATH must be a path without a trailing slash")
  }
  const literal = (value: string) => JSON.stringify(value).replace(/</g, "\\u003c")
  return [
    `const IDE_BASE_PATH=${literal(basePath)};`,
    'const IDE_DEFAULT_THEME="light";',
    `const IDE_STORAGE_SCOPE=${literal(storageScope)};`,
    "const localStorage={getItem:key=>window.localStorage.getItem(IDE_STORAGE_SCOPE+key),setItem:(key,value)=>window.localStorage.setItem(IDE_STORAGE_SCOPE+key,value)};",
    "function ideFetch(path,options={}){const headers=new Headers(options.headers);const csrf=document.cookie.split('; ').find(part=>part.startsWith('csrftoken='));if(IDE_BASE_PATH&&csrf)headers.set('X-CSRFToken',decodeURIComponent(csrf.slice(10)));return window.fetch(IDE_BASE_PATH+path,{...options,headers,credentials:'same-origin'})}",
  ].join("\n")
}
