// Presentation only. Same alpha-preserving ink-to-ivory mapping as the approved HTML.
export function installLogoFilter(doc=document){
 const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg')
 svg.setAttribute('aria-hidden','true');svg.dataset.zegaoIosAppearance='night-logo'
 svg.style.cssText='position:absolute;width:0;height:0;overflow:hidden;pointer-events:none'
 svg.innerHTML='<defs><filter id="zegao-ios-night-ink" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="-0.18 0.18 0 0 0.90 -0.78 0.78 0 0 0.90 -0.76 0.76 0 0 0.83 0 0 0 1 0"/></filter></defs>'
 doc.body.appendChild(svg);return()=>svg.remove()
}
export function syncPageAppearance(dark){
 if(typeof document!=='undefined')document.documentElement.setAttribute('data-zegao-ios-theme',dark?'dark':'light')
}
