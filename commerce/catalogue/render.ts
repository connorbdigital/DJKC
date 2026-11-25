import { BRAND } from "./site";
import { listPrice, type Product } from "../src/catalog";
import { format, money } from "../src/money";
import { deliveryLine, savingPercent, stockLabel, type Fact, type Faq } from "../src/siteModel";

/**
 * The shop's look: one stylesheet, one page shell, and the components the pages
 * are made of. Server-rendered HTML with no framework, because the whole point
 * of the build is that a crawler, an answer engine and a phone all get the same
 * finished page.
 */

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const CSS = `
:root{color-scheme:light;--ink:#15100d;--ink-2:#4a3f38;--muted:#6f6259;--line:#e8ded4;--paper:#fdfaf7;--card:#fff;--pink:#e8607f;--pink-ink:#8d1f3c;--ok:#1f7a4c;--sand:#f3ebe2;--radius:14px;--shadow:0 1px 2px #15100d0d,0 8px 24px #15100d0a}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
h1,h2,h3{font-family:Georgia,"Iowan Old Style","Times New Roman",serif;line-height:1.15;margin:0 0 .5em;letter-spacing:-.01em}
h1{font-size:clamp(1.9rem,4.4vw,3rem)}h2{font-size:clamp(1.3rem,2.4vw,1.9rem)}h3{font-size:1.1rem}
p{margin:0 0 1em}small{font-size:.82rem}
a{color:var(--ink);text-decoration:none}a:hover{text-decoration:underline}
img{max-width:100%;height:auto;display:block}
ul{margin:0 0 1em;padding-left:1.1em}
.wrap{max-width:1180px;margin:0 auto;padding:0 1.15rem}
.skip{position:absolute;left:-9999px;top:0;background:var(--ink);color:#fff;padding:.7rem 1rem;z-index:100}
.skip:focus{left:.5rem;top:.5rem}
:focus-visible{outline:3px solid var(--pink-ink);outline-offset:2px}
.utility{background:var(--ink);color:#f7efe8;font-size:.8rem}
.utility .wrap{display:flex;gap:1.2rem;justify-content:space-between;align-items:center;padding:.45rem 1.15rem;flex-wrap:wrap}
.utility ul{display:flex;gap:1.1rem;list-style:none;margin:0;padding:0;flex-wrap:wrap}
.utility a{color:inherit;display:inline-flex;align-items:center;min-height:24px}
header.site{background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:30}
.head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:1rem;align-items:center;padding:.9rem 1.15rem;max-width:1180px;margin:0 auto}
.brand{font-family:Georgia,serif;font-size:1.5rem;letter-spacing:-.02em;white-space:nowrap}
.brand span{color:var(--pink-ink)}
.search{display:flex;border:1px solid var(--line);border-radius:999px;background:var(--sand);overflow:hidden}
.search input{flex:1;min-width:0;border:0;background:transparent;padding:.7rem 1rem;font:inherit;color:inherit}
.search input:focus{outline:2px solid var(--pink-ink);outline-offset:-2px}
.search button{border:0;background:var(--ink);color:#fff;padding:0 1.1rem;font-weight:700;cursor:pointer}
.head-actions{display:flex;gap:.5rem;align-items:center}
.icon-btn{display:inline-flex;align-items:center;gap:.45rem;border:1px solid var(--line);background:#fff;border-radius:999px;padding:.5rem .85rem;font:inherit;font-size:.85rem;font-weight:600;cursor:pointer;min-height:40px;white-space:nowrap}
.icon-btn:hover{border-color:var(--ink)}
.basket-count{background:var(--pink-ink);color:#fff;border-radius:999px;min-width:1.35rem;padding:0 .3rem;font-size:.72rem;text-align:center;line-height:1.4}
nav.departments{border-top:1px solid var(--line);background:#fff}
/* position:relative keeps the absolutely positioned screen-reader counts inside
   the scroller; without it they escape the clip and stretch the page sideways. */
nav.departments ul{display:flex;position:relative;gap:.15rem;list-style:none;margin:0 auto;padding:.35rem 1.15rem;max-width:1180px;overflow-x:auto;scrollbar-width:none}
nav.departments li{white-space:nowrap}
nav.departments a{display:block;padding:.55rem .7rem;border-radius:999px;font-size:.88rem;font-weight:600;color:var(--ink-2)}
nav.departments a:hover{background:var(--sand);text-decoration:none}
nav.departments a[aria-current="page"]{background:var(--ink);color:#fff}
main{padding-bottom:3rem}
.hero{background:linear-gradient(180deg,#fff 0%,var(--sand) 100%);border-bottom:1px solid var(--line)}
.hero .wrap{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:2rem;align-items:center;padding-top:2.4rem;padding-bottom:2.4rem}
.hero h1{margin-bottom:.6rem}
.hero p.lede{font-size:1.06rem;color:var(--ink-2);max-width:34rem}
.hero-cta{display:flex;gap:.6rem;flex-wrap:wrap;margin:1.2rem 0 .9rem}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;border-radius:999px;padding:.8rem 1.3rem;font-weight:700;font-size:.95rem;border:1px solid var(--ink);background:var(--ink);color:#fff;cursor:pointer;min-height:44px}
.btn:hover{text-decoration:none;background:#000}
.btn.secondary{background:#fff;color:var(--ink)}
.btn.secondary:hover{background:var(--sand)}
.hero-note{font-size:.85rem;color:var(--muted);display:flex;align-items:center;gap:.45rem}
.hero-art{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}
.hero-art img{border-radius:var(--radius);border:1px solid var(--line);background:#fff}
.hero-art img:first-child{grid-column:span 2;aspect-ratio:16/10;object-fit:cover}
.trust{background:#fff;border-bottom:1px solid var(--line)}
.trust ul{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem;list-style:none;margin:0;padding:1rem 0;font-size:.86rem;font-weight:600}
.trust li{display:flex;gap:.55rem;align-items:flex-start;line-height:1.35}
.tick{margin-top:.05rem;width:1.4rem;height:1.4rem;border-radius:999px;background:#e6f4ec;color:var(--ok);display:grid;place-items:center;font-size:.8rem;flex:none}
section.band{padding:2.2rem 0}
.section-head{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:1.1rem;flex-wrap:wrap}
.section-head p{margin:.2rem 0 0;color:var(--muted);font-size:.92rem}
.link-more{display:inline-flex;align-items:center;min-height:28px;font-weight:700;font-size:.88rem;color:var(--pink-ink)}
.depts{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.8rem}
.dept{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:1rem;display:flex;flex-direction:column;gap:.35rem;min-height:112px}
.dept:hover{border-color:var(--ink);text-decoration:none;box-shadow:var(--shadow)}
.dept .name{font-weight:700}
.dept .count{font-size:.8rem;color:var(--muted);margin-top:auto}
.dept.soon{opacity:.72;background:#fbf7f3}
.grid-products{display:grid;grid-template-columns:repeat(auto-fill,minmax(232px,1fr));gap:1rem}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;display:flex;flex-direction:column}
.card:hover{box-shadow:var(--shadow)}
.card .shot{position:relative;background:#f6efe7}
.card .shot img{width:100%;aspect-ratio:1/1;object-fit:cover}
.tag{position:absolute;top:.6rem;left:.6rem;background:var(--pink-ink);color:#fff;font-size:.7rem;font-weight:800;letter-spacing:.04em;padding:.2rem .45rem;border-radius:999px;text-transform:uppercase}
.tag.stock{background:#fff;color:var(--ink-2);left:auto;right:.6rem;border:1px solid var(--line);font-weight:600;text-transform:none;letter-spacing:0}
.card .body{padding:.75rem .8rem .9rem;display:flex;flex-direction:column;gap:.25rem;flex:1}
.card .brand{font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:700}
.card a.name{display:inline-flex;align-items:center;min-height:24px;font-weight:650;line-height:1.32}
.card .desc{font-size:.83rem;color:var(--muted);margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.price-row{display:flex;align-items:baseline;gap:.45rem;margin-top:auto;padding-top:.4rem}
.price{font-weight:800;font-size:1.02rem}
.was{color:var(--muted);text-decoration:line-through;font-size:.85rem}
.delivery{font-size:.76rem;color:var(--muted)}
.stock-in{font-size:.76rem;color:var(--ok);font-weight:600}
.stock-low{font-size:.76rem;color:#a1591a;font-weight:600}
.stock-out{font-size:.76rem;color:#a12b2b;font-weight:600}
.promo{background:var(--ink);color:#fff;border-radius:var(--radius);padding:1.4rem;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:1rem;align-items:center}
.promo p{margin:.2rem 0 0;color:#e6d8cd;font-size:.9rem}
.promo .btn{background:#fff;color:var(--ink);border-color:#fff}
.promises{background:var(--ink);color:#fff;border-radius:var(--radius);padding:1.5rem}
.promises h2{color:#fff;margin-bottom:.2rem}
.promises .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.2rem;margin-top:1.1rem}
.promises h3{font-size:.95rem;color:#fff;margin-bottom:.25rem}
.promises p{margin:0;color:#e6d8cd;font-size:.88rem}
.promises .more{margin:1.1rem 0 0;font-size:.8rem;color:#cbb6a6}
.promises .more a{color:#fff;text-decoration:underline}
.breadcrumbs{font-size:.8rem;color:var(--muted);padding:1rem 0 .2rem}
.breadcrumbs ol{list-style:none;display:flex;gap:.4rem;flex-wrap:wrap;margin:0;padding:0}
.crumbs-wrap{padding:1rem 0}
.product-page{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:2.2rem;padding:1rem 0 1rem}
.gallery img{border-radius:var(--radius);border:1px solid var(--line);background:#fff;width:100%}
.buybox{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:1.2rem}
.buybox .price{font-size:1.7rem}
.buybox .delivery-line{font-size:.86rem;color:var(--ink-2);margin:.6rem 0}
.buybox .stock-line{font-weight:700;font-size:.92rem;margin:.3rem 0 .8rem}
.buynow{display:flex;gap:.6rem;flex-wrap:wrap}
.qty{display:flex;align-items:center;border:1px solid var(--line);border-radius:999px;overflow:hidden}
.qty button{border:0;background:#fff;padding:.55rem .8rem;font-size:1rem;cursor:pointer}
.qty input{width:2.5rem;border:0;text-align:center;font:inherit;padding:.55rem 0}
.facts{width:100%;border-collapse:collapse;margin:0 0 1rem;font-size:.9rem}
.facts th,.facts td{text-align:left;padding:.5rem .2rem;border-bottom:1px solid var(--line);vertical-align:top}
.facts th{color:var(--muted);font-weight:600;width:42%}
.accordion{background:#fff;border:1px solid var(--line);border-radius:var(--radius);margin:1rem 0}
.accordion details{border-bottom:1px solid var(--line)}
.accordion details:last-child{border-bottom:0}
.accordion summary{cursor:pointer;padding:.85rem 1rem;font-weight:650;list-style:none;display:flex;justify-content:space-between;gap:1rem}
.accordion summary::-webkit-details-marker{display:none}
.accordion summary::after{content:"+";color:var(--muted)}
.accordion details[open] summary::after{content:"–"}
.accordion .inner{padding:0 1rem 1rem;color:var(--ink-2);font-size:.92rem}
.faq{display:grid;gap:.6rem}
.faq details{background:#fff;border:1px solid var(--line);border-radius:var(--radius)}
.faq summary{cursor:pointer;padding:.9rem 1rem;font-weight:650}
.faq .a{padding:0 1rem 1rem;color:var(--ink-2)}
.epilogue{background:var(--sand);border-top:1px solid var(--line)}
.epilogue .wrap{padding:2rem 1.15rem}
.epilogue h2{font-size:1.2rem}
.epilogue ul{columns:2;column-gap:2rem}
@media(max-width:760px){.epilogue ul{columns:1}}
.signup{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.6rem}
.signup input{flex:1;min-width:12rem;border:1px solid var(--line);border-radius:999px;padding:.7rem 1rem;font:inherit;background:#fff}
footer.site{background:#fff;border-top:1px solid var(--line);padding:2.2rem 0 1.4rem;font-size:.88rem}
footer.site .cols{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1.4rem}
footer.site h3{font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-family:inherit}
footer.site ul{list-style:none;padding:0;margin:0;display:grid;gap:.1rem}
/* 44px is the touch target; 24 is the floor. Padding, not gap, does the work. */
footer.site ul a{display:inline-flex;align-items:center;min-height:28px;padding:.25rem 0}
.legal{border-top:1px solid var(--line);margin-top:1.6rem;padding-top:1rem;display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;color:var(--muted);font-size:.78rem}
.pay{display:flex;gap:.4rem;flex-wrap:wrap}
.pay span{border:1px solid var(--line);border-radius:6px;padding:.15rem .4rem;font-size:.68rem;color:var(--muted);letter-spacing:.02em}
.basket-dialog{border:0;border-radius:16px;padding:0;width:min(30rem,92vw);box-shadow:0 20px 60px #15100d33}
.basket-dialog::backdrop{background:#15100d66}
.basket-head{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.1rem;border-bottom:1px solid var(--line)}
.basket-head h2{margin:0;font-size:1.15rem}
.basket-body{padding:1rem 1.1rem;max-height:55vh;overflow:auto}
.basket-line{display:flex;gap:.7rem;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--line)}
.basket-line img{width:56px;height:56px;border-radius:8px;border:1px solid var(--line)}
.basket-line .t{flex:1;font-size:.88rem;font-weight:600}
.basket-foot{padding:1rem 1.1rem;border-top:1px solid var(--line);background:#fcf8f4}
.basket-line{display:grid;grid-template-columns:56px minmax(0,1fr) auto;gap:.7rem;align-items:center;padding:.65rem 1.1rem;border-bottom:1px solid var(--line)}
.basket-line img{border-radius:8px;display:block}
.basket-line .t{display:grid;gap:.25rem;font-weight:600;font-size:.92rem;line-height:1.3}
.basket-line .t small{font-weight:500;color:var(--muted);font-size:.78rem}
.basket-line .line-total{font-weight:700;font-variant-numeric:tabular-nums}
.line-qty{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:999px;overflow:hidden;width:max-content;margin-top:.15rem}
.line-qty button{border:0;background:#fff;width:30px;height:28px;font-size:.95rem;cursor:pointer;line-height:1}
.line-qty span{min-width:1.6rem;text-align:center;font-size:.82rem;font-weight:600}
.line-remove{border:0;background:none;padding:.35rem 0;font:inherit;font-size:.78rem;color:var(--muted);text-decoration:underline;cursor:pointer;min-height:24px}
.ship-note{margin:.55rem 0 0;font-size:.82rem;color:#2c6350;font-weight:600}
.ship-note.waiting{color:#6b4a12}
.ship-bar{height:6px;border-radius:999px;background:#efe4d8;overflow:hidden;margin:.4rem 0 .2rem}
.ship-bar span{display:block;height:100%;background:#2c6350;border-radius:999px;transition:width .25s ease}
.notice{background:#fff5e5;border:1px solid #f0d9a8;border-radius:10px;padding:.7rem .8rem;font-size:.8rem;color:#6b4a12;margin-top:.7rem}
.empty{color:var(--muted);font-size:.9rem}
.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media(max-width:960px){.hero .wrap{grid-template-columns:1fr}.product-page{grid-template-columns:1fr}footer.site .cols{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:700px){
  .head{grid-template-columns:1fr auto;grid-template-areas:"brand actions" "search search";gap:.6rem}
  .brand{grid-area:brand;font-size:1.28rem}
  .head-actions{grid-area:actions;gap:.4rem}
  /* The department rail does this job on a phone; the extra pill only squeezes the brand. */
  .head-actions .browse{display:none}
  .search{grid-area:search}
  .search input{padding:.6rem .85rem;font-size:.92rem}
  .utility .wrap{flex-wrap:nowrap;overflow-x:auto;gap:1rem;padding:.4rem 1.15rem;scrollbar-width:none}
  .utility ul{flex-wrap:nowrap}
  .utility li{white-space:nowrap}
  .trust ul{grid-template-columns:1fr 1fr}
  .promo{grid-template-columns:1fr}
  .basket-dialog{width:min(30rem,96vw)}
  /* Two stacked calls to action of different widths read as an accident. */
  .hero-cta{flex-direction:column;align-items:stretch}
  .hero-cta a{justify-content:center}
  .hero .wrap{padding-top:1.6rem;padding-bottom:1.8rem}
  /* Twelve tiles stacked one per screen is a wall, not a menu. */
  .depts{grid-template-columns:repeat(2,minmax(0,1fr));gap:.6rem}
  .dept{min-height:88px;padding:.8rem}
  .dept .name{font-size:.92rem;line-height:1.25}
  .promises{padding:1.15rem}
  .promises .grid{grid-template-columns:1fr;gap:.9rem}
}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

/** Basket persistence, search filtering and the demo notices. No framework, no network. */
export const CLIENT_JS = `
(function(){
  var KEY="ecommerce-basket";
  var FREE_OVER=${BRAND.delivery.freeOver};
  var SHIP=${BRAND.delivery.standard};
  var read=function(){try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch(e){return []}};
  var write=function(lines){try{localStorage.setItem(KEY,JSON.stringify(lines))}catch(e){}};
  var count=function(){return read().reduce(function(n,l){return n+l.qty},0)};
  var badge=document.querySelector("[data-basket-count]");
  var paint=function(){if(badge)badge.textContent=count()};
  var dialog=document.querySelector("[data-basket-dialog]");
  var pennies=function(price){return Math.round(parseFloat(String(price).replace(/[^0-9.]/g,""))*100)||0};
  var pounds=function(minor){return "£"+(minor/100).toFixed(2)};
  var clamp=function(n){return Math.max(1,Math.min(10,n||1))};

  document.addEventListener("click",function(event){
    var stepper=event.target.closest("[data-qty-up],[data-qty-down]");
    if(stepper){
      event.preventDefault();
      var box=stepper.parentElement.querySelector("[data-qty]");
      if(box){box.value=clamp(parseInt(box.value,10)+(stepper.hasAttribute("data-qty-up")?1:-1))}
      return;
    }
    var add=event.target.closest("[data-add]");
    if(add){
      event.preventDefault();
      var lines=read();var id=add.getAttribute("data-add");
      var buy=add.closest(".buynow");
      var qtyBox=buy&&buy.querySelector("[data-qty]");
      var qty=clamp(qtyBox?parseInt(qtyBox.value,10):1);
      var found=lines.filter(function(l){return l.id===id})[0];
      if(found){found.qty=clamp(found.qty+qty)}else{lines.push({id:id,title:add.getAttribute("data-title"),price:add.getAttribute("data-price"),image:add.getAttribute("data-image"),qty:qty})}
      write(lines);paint();open();
      return;
    }
    var step=event.target.closest("[data-line-up],[data-line-down]");
    if(step){
      event.preventDefault();
      var up=step.hasAttribute("data-line-up");
      var target=step.getAttribute(up?"data-line-up":"data-line-down");
      var next=read().map(function(l){if(l.id===target){l.qty=clamp(l.qty+(up?1:-1))}return l}).filter(function(l){return l.qty>0});
      write(next);paint();render();
      return;
    }
    var drop=event.target.closest("[data-line-remove]");
    if(drop){
      event.preventDefault();
      write(read().filter(function(l){return l.id!==drop.getAttribute("data-line-remove")}));
      paint();render();
      return;
    }
    if(event.target.closest("[data-basket-open]")){event.preventDefault();open();return}
    if(event.target.closest("[data-basket-close]")){if(dialog)dialog.close()}
    if(event.target.closest("[data-clear]")){write([]);paint();render();}
  });
  function open(){if(!dialog)return;render();if(dialog.showModal)dialog.showModal()}
  function render(){
    var body=dialog&&dialog.querySelector("[data-basket-body]");
    var total=dialog&&dialog.querySelector("[data-basket-total]");
    var ship=dialog&&dialog.querySelector("[data-basket-ship]");
    if(!body)return;
    var lines=read();
    if(!lines.length){body.innerHTML='<p class="empty" style="padding:1rem 1.1rem">Nothing in the basket yet.</p>'}
    else{body.innerHTML=lines.map(function(l){
      return '<div class="basket-line"><img src="'+l.image+'" alt="" width="56" height="56">'
        +'<span class="t">'+l.title+'<small>'+l.price+' each</small>'
        +'<span class="line-qty"><button type="button" aria-label="One fewer '+l.title.replace(/"/g,"")+'" data-line-down="'+l.id+'">−</button><span>'+l.qty+'</span><button type="button" aria-label="One more '+l.title.replace(/"/g,"")+'" data-line-up="'+l.id+'">+</button></span>'
        +'<button type="button" class="line-remove" data-line-remove="'+l.id+'">Remove</button></span>'
        +'<span class="line-total">'+pounds(pennies(l.price)*l.qty)+'</span></div>'
    }).join("")}
    var sum=lines.reduce(function(n,l){return n+pennies(l.price)*l.qty},0);
    if(total){total.textContent=(sum/100).toFixed(2)}
    if(ship){
      if(!lines.length){ship.innerHTML=''}
      else if(sum>=FREE_OVER){ship.innerHTML='<p class="ship-note">Free delivery applied. Order before 2pm for dispatch today.</p><div class="ship-bar"><span style="width:100%"></span></div>'}
      else{ship.innerHTML='<p class="ship-note waiting">'+pounds(FREE_OVER-sum)+' more for free delivery — otherwise '+pounds(SHIP)+'.</p><div class="ship-bar"><span style="width:'+Math.round(sum/FREE_OVER*100)+'%"></span></div>'}
    }
  }
  paint();
  if(dialog&&dialog.addEventListener){dialog.addEventListener("click",function(e){if(e.target===dialog)dialog.close()})}

  var results=document.querySelector("[data-search-results]");
  if(results){
    var params=new URLSearchParams(location.search);
    var q=(params.get("q")||"").trim();
    var input=document.querySelector("[data-search-input]");
    if(input){input.value=q}
    var heading=document.querySelector("[data-search-heading]");
    if(heading){heading.textContent=q?'Results for “'+q+'”':'Search the shop'}
    var strip=function(word){return word.replace(/(ies)$/,"y").replace(/(es|s)$/,"")};
    var close=function(a,b){
      if(a===b)return true;
      if(a.length<5||b.length<5||Math.abs(a.length-b.length)>1)return false;
      var longer=a.length>=b.length?a:b,shorter=a.length>=b.length?b:a,misses=0,skip=0;
      for(var i=0;i<longer.length;i++){
        if(longer[i]===shorter[i-skip])continue;
        misses++;skip++;
        if(misses>1)return false;
      }
      return true;
    };
    var score=function(tokens,word){
      if(tokens.indexOf(word)>-1)return 3;
      var stem=strip(word);
      if(tokens.some(function(t){return strip(t)===stem}))return 2.6;
      if(word.length>=3&&tokens.some(function(t){return t.indexOf(word)===0}))return 2;
      if(tokens.some(function(t){return close(word,t)||close(word,strip(t))}))return 1.5;
      return 0;
    };
    Promise.all([
      fetch("products.json").then(function(r){return r.json()}),
      fetch("search-index.json").then(function(r){return r.json()}).catch(function(){return []})
    ]).then(function(both){
      var products=both[0].products||[];
      var index={};
      (both[1]||[]).forEach(function(doc){index[doc.id]=doc.tokens||[]});
      var words=q.toLowerCase().split(/[^a-z0-9]+/).filter(function(w){return w.length>1});
      var scored=products.map(function(p){
        var tokens=(index[p.id]||[]).concat(String(p.title+" "+p.category+" "+p.brand).toLowerCase().split(/[^a-z0-9]+/));
        var total=0,hit=0;
        words.forEach(function(word){var s=score(tokens,word);if(s>0){hit++;total+=s}});
        return {product:p,score:words.length?total:1,hit:hit};
      });
      var keep=words.length?scored.filter(function(entry){return entry.hit===words.length}).concat(scored.filter(function(entry){return entry.hit>0&&entry.hit<words.length})).filter(function(entry,index,all){return all.indexOf(entry)===index}):scored;
      keep.sort(function(a,b){return b.score-a.score});
      var hits=keep.slice(0,48).map(function(entry){return entry.product});
      if(!hits.length){
        results.innerHTML='<p class="empty">Nothing matched “'+q+'”. The catalogue is small on purpose — try a department: <a href="department/garden.html">Garden</a>, <a href="department/kitchen.html">Kitchen</a> or <a href="department/storage.html">Storage</a>.</p>';
        return;
      }
      results.innerHTML=hits.map(function(p){
        return '<article class="card"><a class="shot" href="product/'+p.slug+'.html"><img src="'+p.images[0].url+'" alt="'+p.images[0].alt.replace(/"/g,"&quot;")+'" width="600" height="600" loading="lazy"></a><div class="body"><span class="brand">'+p.brand+'</span><a class="name" href="product/'+p.slug+'.html">'+p.title+'</a><div class="price-row"><span class="price">£'+p.price+'</span></div><span class="delivery">'+p.category+'</span></div></article>'
      }).join("")
      if(heading){heading.textContent=q?'Results for “'+q+'” ('+hits.length+')':'Search the shop'}
    }).catch(function(){results.innerHTML='<p class="empty">The search index did not load.</p>'})
  }

  document.querySelectorAll("form[data-demo-form]").forEach(function(form){
    form.addEventListener("submit",function(event){
      event.preventDefault();
      var note=(form.parentElement||document).querySelector("[data-demo-note]");
      if(note){note.hidden=false}
    });
  });
})();
`;

export interface NavItem {
  label: string;
  href: string;
  current?: boolean;
  count?: number;
}

export interface PageOptions {
  title: string;
  description: string;
  canonical: string;
  body: string;
  nav: NavItem[];
  jsonLd: object[];
  robots?: string;
  /** Depth of the page in the tree, used to fix relative asset paths. */
  depth?: number;
  activeDept?: string;
  updated: string;
}

const prefix = (depth: number) => (depth === 0 ? "" : "../".repeat(depth));

export function renderPage(options: PageOptions): string {
  const p = prefix(options.depth ?? 0);
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.title)}</title>
<meta name="description" content="${escapeHtml(options.description)}">
<meta name="robots" content="${options.robots ?? "index,follow,max-image-preview:large,max-snippet:-1"}">
<link rel="canonical" href="${options.canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escapeHtml(BRAND.name)}">
<meta property="og:title" content="${escapeHtml(options.title)}">
<meta property="og:description" content="${escapeHtml(options.description)}">
<meta property="og:url" content="${options.canonical}">
<meta property="og:image" content="${BRAND.url}/${p}assets/og.svg">
<meta property="og:image:type" content="image/svg+xml">
<meta property="og:image:alt" content="${escapeHtml(BRAND.name)} — ${escapeHtml(BRAND.tagline)}">
<meta property="og:locale" content="en_GB">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#e8607f">
<link rel="alternate" type="application/json" href="${p}products.json" title="Catalogue data">
<link rel="alternate" type="text/plain" href="${p}llms.txt" title="Facts for answer engines">
${options.jsonLd.map((data) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`).join("\n")}
<style>${CSS}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="utility"><div class="wrap">
  <ul>
    <li>${escapeHtml(BRAND.trust[0])}</li>
    <li>${escapeHtml(BRAND.trust[1])}</li>
    <li>${escapeHtml(BRAND.trust[2])}</li>
  </ul>
  <ul><li><a href="${p}pages/contact.html">Help &amp; contact</a></li><li>Prices include VAT</li></ul>
</div></div>
<header class="site">
  <div class="head">
    <a class="brand" href="${p}index.html">Exomm<span>eece</span></a>
    <form class="search" action="${p}search.html" method="get" role="search">
      <label class="visually-hidden" for="q">Search products</label>
      <input id="q" type="search" name="q" placeholder="Search 32 products — try “oak” or “planter”" data-search-input>
      <button type="submit">Search</button>
    </form>
    <div class="head-actions">
      <a class="icon-btn browse" href="${p}search.html">Browse all</a>
      <button class="icon-btn" type="button" data-basket-open aria-label="Basket">
        Basket <span class="basket-count" data-basket-count>0</span>
      </button>
    </div>
  </div>
  <nav class="departments" aria-label="Departments">
    <ul>
      ${options.nav
        .map(
          (item) =>
            `<li><a href="${p}${item.href}"${item.current ? ' aria-current="page"' : ""}>${escapeHtml(item.label)}${
              item.count !== undefined ? ` <span class="visually-hidden">(${item.count} products)</span>` : ""
            }</a></li>`
        )
        .join("\n      ")}
    </ul>
  </nav>
</header>
<main id="main">
${options.body}
</main>
<footer class="site">
  <div class="wrap">
    <div class="cols">
      <div>
        <h3>Shop</h3>
        <ul>
          <li><a href="${p}index.html">Home</a></li>
          <li><a href="${p}shop.html">All products</a></li>
          <li><a href="${p}pages/delivery-returns.html">Delivery &amp; returns</a></li>
        </ul>
      </div>
      <div>
        <h3>Departments</h3>
        <ul>
          ${options.nav
            .slice(0, 5)
            .map((item) => `<li><a href="${p}${item.href}">${escapeHtml(item.label)}</a></li>`)
            .join("\n          ")}
        </ul>
      </div>
      <div>
        <h3>Help</h3>
        <ul>
          <li><a href="${p}pages/contact.html">Contact</a></li>
          <li><a href="${p}pages/delivery-returns.html">Returns policy</a></li>
          <li><a href="${p}llms.txt">Facts for AI assistants</a></li>
          <li><a href="${p}products.json">Product data (JSON)</a></li>
        </ul>
      </div>
      <div>
        <h3>About</h3>
        <ul>
          <li><a href="${p}pages/about.html">Why this shop exists</a></li>
          <li><a href="${p}pages/about.html#if-not-working">If something goes wrong</a></li>
          <li><a href="${p}pages/about.html#the-build">How it is built</a></li>
        </ul>
      </div>
    </div>
    <div class="legal">
      <p style="margin:0">${escapeHtml(BRAND.notice)} Updated ${options.updated}.</p>
      <div class="pay" aria-label="Payment methods we are building for">
        <span>Visa</span><span>Mastercard</span><span>Amex</span><span>Apple Pay</span><span>PayPal</span><span>Klarna</span>
      </div>
    </div>
  </div>
</footer>
<dialog class="basket-dialog" data-basket-dialog aria-labelledby="basket-title">
  <div class="basket-head">
    <h2 id="basket-title">Your basket</h2>
    <button class="icon-btn" type="button" data-basket-close aria-label="Close basket">Close</button>
  </div>
  <div class="basket-body" data-basket-body></div>
  <div class="basket-foot">
    <div data-basket-ship></div>
    <p style="display:flex;justify-content:space-between;margin:.5rem 0 .6rem;font-weight:700"><span>Subtotal</span><span>£<span data-basket-total>0.00</span></span></p>
    <button class="btn" type="button" disabled aria-describedby="checkout-note">Checkout — not connected</button>
    <p class="notice" id="checkout-note">The basket is stored in this browser only. There is no payment provider connected — checkout is the first item in GAPS.md, not a button that pretends.</p>
    <button class="icon-btn" type="button" data-clear style="margin-top:.6rem">Empty basket</button>
  </div>
</dialog>
<script>${CLIENT_JS}</script>
</body>
</html>
`;
}

/** One product card, used on the home page, department pages and search results. */
export function productCard(product: Product, options: { href: string; imageBase?: string; priority?: boolean } = { href: "#" }): string {
  const price = listPrice(product);
  const variant = product.variants[0];
  const stock = variant ? stockLabel(variant) : null;
  const saving = savingPercent(product);
  const image = product.images[0];
  return `<article class="card">
  <a class="shot" href="${options.href}" aria-hidden="true" tabindex="-1">
    <img src="${(options.imageBase ?? "") + (image?.url ?? "")}" alt="${escapeHtml(image?.alt ?? product.title)}" width="600" height="600"${
      options.priority ? "" : ' loading="lazy"'
    } decoding="async">
    ${reviewedTag(saving, stock)}
  </a>
  <div class="body">
    <span class="brand">${escapeHtml(product.brand)}</span>
    <a class="name" href="${options.href}">${escapeHtml(product.title)}</a>
    <p class="desc">${escapeHtml(product.description)}</p>
    <div class="price-row">
      <span class="price">${price ? format(price) : "—"}</span>
      ${variant?.compareAt ? `<span class="was">${format(variant.compareAt)}</span>` : ""}
    </div>
    <span class="delivery">${escapeHtml(deliveryLine(product))}</span>
    ${stock ? `<span class="stock-${stock.tone}">${escapeHtml(stock.text)}</span>` : ""}
  </div>
</article>`;
}

const reviewedTag = (saving: number | null, stock: { text: string } | null) => {
  if (saving) return `<span class="tag">Save ${saving}%</span>`;
  if (stock && /left/.test(stock.text)) return `<span class="tag stock">${escapeHtml(stock.text)}</span>`;
  return "";
};

export function breadcrumbs(items: { label: string; href?: string }[]): string {
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><div class="wrap"><ol>
    ${items
      .map((item, index) =>
        item.href
          ? `<li><a href="${item.href}">${escapeHtml(item.label)}</a>${index < items.length - 1 ? " <span aria-hidden=\"true\">›</span>" : ""}</li>`
          : `<li aria-current="page">${escapeHtml(item.label)}</li>`
      )
      .join("\n    ")}
  </ol></div></nav>`;
}

export function faqBlock(faqs: Faq[], heading = "Questions people ask"): string {
  return `<section class="band" aria-labelledby="faq-heading">
  <div class="wrap">
    <div class="section-head"><div><h2 id="faq-heading">${escapeHtml(heading)}</h2><p>Short answers, no chat window.</p></div></div>
    <div class="faq">
      ${faqs
        .map(
          (faq) => `<details><summary>${escapeHtml(faq.question)}</summary><div class="a"><p>${escapeHtml(faq.answer)}</p></div></details>`
        )
        .join("\n      ")}
    </div>
  </div>
</section>`;
}

export function factsTable(facts: Fact[]): string {
  return `<table class="facts"><caption class="visually-hidden">Key facts</caption><tbody>
    ${facts.map((fact) => `<tr><th scope="row">${escapeHtml(fact.label)}</th><td>${escapeHtml(fact.value)}</td></tr>`).join("\n    ")}
  </tbody></table>`;
}

export function sectionHead(title: string, note: string, link?: { label: string; href: string }): string {
  return `<div class="section-head"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(note)}</p></div>${
    link ? `<a class="link-more" href="${link.href}">${escapeHtml(link.label)} →</a>` : ""
  }</div>`;
}

export function priceLabel(amountMinor: number): string {
  return format(money(amountMinor, "GBP"));
}
