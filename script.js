// === CONFIG - CHANGE THESE ===
const SUPABASE_URL = "https://brnbgssdiwgzcbxhgnai.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJybmJnc3NkaXdnemNieGhnbmFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzODEyODAsImV4cCI6MjEwNjk1NzI4MH0.GTdVtUUXeflCO4mgSiPGkK7Gh5jXsG_fKGTDK6QagqI";
const PAYSTACK_PUBLIC_KEY = "pk_test_3593e90efaaf79ab84e683acab2ec0646803e035";
const ADMIN_WHATSAPP = "+233551971169"; // Owner number e.g 233244123456
const ADMIN_EMAILS = new Set([
  'yeboahsamuel946@gmail.com',
  'ntembenedicta904@gmail.com'
]);
// === END CONFIG ===

const { createClient } = supabase;
const client = createClient(SUPABASE_URL, SUPABASE_KEY);

function isSupabaseConfigured(){
  return SUPABASE_URL.startsWith('https://')
    && !SUPABASE_URL.includes('YOUR_PROJECT_ID')
    && Boolean(SUPABASE_KEY)
    && !SUPABASE_KEY.includes('YOUR_ANON_KEY_HERE');
}
function showSupabaseSetupMessage(){
  alert('Supabase is not configured. In script.js, replace SUPABASE_URL and SUPABASE_KEY with your project URL and anon/public key from Supabase Project Settings > API, then reload the page.');
}

let allProducts = [];
let allOrders = [];
let cart = JSON.parse(localStorage.getItem('cart')||'[]');
let currentFilter = 'all';
let currentUser = null;

// VIEW SWITCHER
function showView(viewName){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById(viewName+'View').classList.add('active');
  if(viewName==='admin'){
    updateAdminAccess();
    if(isAdminUser()) loadAdmin();
  }
  if(viewName==='shop') fetchProducts();
}

function isAdminUser(user=currentUser){
  return Boolean(user?.email&&ADMIN_EMAILS.has(user.email.toLowerCase()));
}
function updateAdminAccess(message){
  const authorized=isAdminUser();
  document.getElementById('adminAuth').hidden=authorized;
  document.getElementById('adminContent').hidden=!authorized;
  document.getElementById('adminSignOut').hidden=!currentUser;
  const authMessage=document.getElementById('adminAuthMessage');
  authMessage.textContent=message||(currentUser
    ? `The account ${currentUser.email} is not authorized to access the admin section.`
    : 'Sign in with an authorized admin account.');
}
async function signInAdmin(event){
  event.preventDefault();
  const email=document.getElementById('adminEmail').value.trim().toLowerCase();
  if(!ADMIN_EMAILS.has(email)){
    updateAdminAccess('This email is not authorized to access the admin section.');
    return;
  }
  if(!isSupabaseConfigured()){
    updateAdminAccess('Supabase is not configured. Update the project URL and public key in script.js.');
    return;
  }
  const {data,error}=await client.auth.signInWithPassword({
    email,
    password:document.getElementById('adminPassword').value
  });
  if(error){
    updateAdminAccess(`Sign in failed: ${error.message}`);
    return;
  }
  currentUser=data.user;
  updateAdminAccess();
  if(isAdminUser()) await loadAdmin();
}
async function signOutAdmin(){
  const {error}=await client.auth.signOut();
  if(error){
    alert(`Sign out failed: ${error.message}`);
    return;
  }
  currentUser=null;
  allOrders=[];
  updateAdminAccess('You have been signed out.');
}

// ========== SHOP LOGIC ==========
async function fetchProducts(){
  if(!isSupabaseConfigured()){
    document.getElementById('products').innerHTML='<p>Connect your Supabase project in script.js to load products.</p>';
    updateCartCount();
    return;
  }
  const {data}=await client.from('products').select('*').order('created_at',{ascending:false});
  allProducts=data||[];
  renderShop(allProducts);
  updateCartCount();
}
function renderShop(list){
  const el=document.getElementById('products');
  if(!el) return;
  if(!list.length){el.innerHTML='<p>No clothes yet. Go to Admin to add.</p>';return;}
  el.innerHTML=list.map(p=>{
    const discount=p.old_price?Math.round((1-p.price/p.old_price)*100):0;
    const images=productImages(p);
    const details=productDetails(p.description);
    return `<div class="property-card">
      <div class="product-gallery"><img class="gallery-main" src="${images[0]||''}" alt="${p.name}">
        ${images.length>1?`<div class="gallery-thumbnails">${images.map(image=>`<button type="button" onclick="this.closest('.product-gallery').querySelector('.gallery-main').src=this.querySelector('img').src" aria-label="View another ${p.name} image"><img src="${image}" alt=""></button>`).join('')}</div>`:''}
      </div><div class="info">
        ${discount?`<span class="badge">-${discount}%</span>`:''} <small>${p.category||''} â€¢ ${p.size||''}</small>
        <div style="font-weight:700;margin-top:5px">${p.name}</div>
        <div><span class="price">GHS ${p.price}</span>${p.old_price?`<span class="old">GHS ${p.old_price}</span>`:''}</div>
        <div style="font-size:12px;color:${p.stock<5?'red':'#64748b'}">Stock: ${p.stock}</div>
        ${details.length?`<details class="product-details"><summary>Product details (${details.length})</summary><dl>${details.map(detail=>`<div><dt>${escapeHtml(detail.label)}</dt><dd>${escapeHtml(detail.value)}</dd></div>`).join('')}</dl></details>`:''}
        <button onclick="addToCart('${p.id}')">Add to Cart</button>
      </div>
    </div>`;
  }).join('');
}
function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,char=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  })[char]);
}
function productDetails(description){
  if(typeof description!=='string'||!description.trim()) return [];
  try{
    const parsed=JSON.parse(description);
    if(parsed?.format==='product-details-v1'&&Array.isArray(parsed.details)){
      return parsed.details.filter(detail=>
        detail&&typeof detail.label==='string'&&typeof detail.value==='string'
          &&detail.label.trim()&&detail.value.trim()
      );
    }
  }catch{}
  return [{label:'Description',value:description}];
}
function addProductDetailRow(){
  const row=document.createElement('div');
  row.className='product-detail-row';
  row.innerHTML='<input class="product-detail-label" aria-label="Detail name" placeholder="e.g. Material"><input class="product-detail-value" aria-label="Detail value" placeholder="e.g. 100% cotton"><button class="remove-detail" type="button" aria-label="Remove detail">×</button>';
  document.getElementById('productDetailRows').append(row);
  row.querySelector('.product-detail-label').focus();
}
function productImages(product){
  const value=product.image_url;
  if(typeof value!=='string'||!value) return [];
  try{
    const images=JSON.parse(value);
    if(Array.isArray(images)) return images.filter(image=>typeof image==='string'&&image);
  }catch{}
  return [value];
}
function addToCart(id){
  const prod=allProducts.find(p=>p.id===id);
  const existing=cart.find(c=>c.id===id);
  if(existing) existing.qty+=1; else cart.push({id, name:prod.name, price:prod.price, qty:1});
  localStorage.setItem('cart',JSON.stringify(cart));
  updateCartCount();
  alert('Added to cart!');
}
function updateCartCount(){ const el=document.getElementById('cartCount'); if(el) el.innerText=cart.reduce((s,c)=>s+c.qty,0); }
function openCart(){ renderCart(); document.getElementById('cartModal').style.display='flex'; }
function closeCart(){ document.getElementById('cartModal').style.display='none'; }
function renderCart(){
  const el=document.getElementById('cartItems');
  if(!cart.length){el.innerHTML='<p>Cart empty</p>'; document.getElementById('cartTotal').innerText='0'; return;}
  el.innerHTML=cart.map((c,i)=>`<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span>${c.name} x${c.qty}</span><span>GHS ${c.price*c.qty} <button onclick="removeItem(${i})" style="background:red;padding:2px 6px;color:white;border:0;border-radius:4px;width:auto">x</button></span></div>`).join('');
  document.getElementById('cartTotal').innerText=cart.reduce((s,c)=>s+c.price*c.qty,0);
}
function removeItem(i){ cart.splice(i,1); localStorage.setItem('cart',JSON.stringify(cart)); renderCart(); updateCartCount(); }

async function checkout(){
  const name=document.getElementById('custName').value.trim(), phone=document.getElementById('custPhone').value.trim(), addr=document.getElementById('custAddr').value.trim();
  if(!name||!phone){alert('Enter name and phone');return;}
  if(!cart.length){alert('Cart empty');return;}
  const total=cart.reduce((s,c)=>s+c.price*c.qty,0);
  if(!cart.every(item=>Number.isFinite(Number(item.price))&&Number(item.price)>0&&Number.isFinite(Number(item.qty))&&Number(item.qty)>0)||!Number.isFinite(total)||total<=0){
    alert('Your order has an invalid amount. Remove invalid items or contact the store.');
    return;
  }
  const method=document.querySelector('input[name="payMethod"]:checked').value;
  if(method==='delivery'){ await saveOrder(name,phone,addr,total,'Unpaid - Pay on Delivery','New'); } 
  else { payWithPaystack(name,phone,addr,total); }
}
async function saveOrder(name,phone,addr,total,paymentStatus,orderStatus){
  if(!Number.isFinite(Number(total))||Number(total)<=0){alert('Order total must be greater than zero.');return;}
  const trackingToken=crypto.randomUUID();
  const orderItems=cart.map(item=>({...item}));
  const {error}=await client.from('orders').insert({
    customer_name:name,customer_phone:phone,address:addr,items:orderItems,total:total,
    status:orderStatus,payment_status:paymentStatus,tracking_token:trackingToken
  });
  if(error){alert(error.message);return;}
  let itemsText=orderItems.map(c=>`- ${c.name} x${c.qty} = GHS ${c.price*c.qty}`).join('%0A');
  let waMsg=`${paymentStatus.includes('Paid')?'âœ… PAID ORDER':'ðŸ›’ NEW ORDER (Pay on Delivery)'}%0A%0AName: ${name}%0APhone: ${phone}%0AAddress: ${addr}%0A%0AItems:%0A${itemsText}%0A%0ATotal: GHS ${total}%0APayment: ${paymentStatus}`;
  window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${waMsg}`,'_blank');
  cart=[]; localStorage.removeItem('cart'); updateCartCount(); closeCart();
  showOrderConfirmation(trackingToken,paymentStatus);
}
function showOrderConfirmation(trackingToken,paymentStatus){
  document.getElementById('confirmationMessage').textContent=paymentStatus.includes('Paid')
    ? 'Payment received and your order has been submitted.'
    : 'Your order has been submitted. The store will contact you to confirm.';
  document.getElementById('confirmationTrackingCode').textContent=trackingToken;
  document.getElementById('confirmationModal').style.display='flex';
}
function closeConfirmation(){
  document.getElementById('confirmationModal').style.display='none';
}
async function copyTrackingReference(){
  try{
    await navigator.clipboard.writeText(document.getElementById('confirmationTrackingCode').textContent);
    alert('Tracking reference copied.');
  }catch(error){
    alert(`Could not copy the tracking reference: ${error.message}`);
  }
}
function openTracking(){
  document.getElementById('trackingModal').style.display='flex';
  document.getElementById('trackingCode').focus();
}
function closeTracking(){
  document.getElementById('trackingModal').style.display='none';
}
async function trackOrder(event){
  event.preventDefault();
  const input=document.getElementById('trackingCode');
  const result=document.getElementById('trackingResult');
  const token=input.value.trim();
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)){
    result.textContent='Enter the full tracking reference from your confirmation.';
    result.className='tracking-result error';
    return;
  }
  result.textContent='Checking your order...';
  result.className='tracking-result';
  const {data,error}=await client.rpc('track_order',{p_tracking_token:token});
  if(error){
    result.textContent=`Could not check the order: ${error.message}`;
    result.className='tracking-result error';
    return;
  }
  if(!data?.length){
    result.textContent='No order found for that tracking reference. Check it and try again.';
    result.className='tracking-result error';
    return;
  }
  const order=data[0];
  const placedAt=new Date(order.created_at).toLocaleString();
  result.innerHTML=`<strong>Status: ${escapeHtml(order.status||'Processing')}</strong><span>Payment: ${escapeHtml(order.payment_status||'Pending')}</span><span>Placed: ${escapeHtml(placedAt)}</span>`;
  result.className='tracking-result success';
}
function payWithPaystack(name,phone,addr,total){
  if(!Number.isFinite(Number(total))||Number(total)<=0){alert('Payment amount must be greater than zero.');return;}
  if(!PAYSTACK_PUBLIC_KEY.includes('pk_')){alert('Add Paystack Public Key in app.js');return;}
  let handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY, email: `${phone}@customer.com`, amount: total*100, currency:'GHS',
    ref: 'ELITE_'+Math.floor((Math.random()*1000000000)+1),
    callback: function(response){ saveOrder(name,phone,addr,total,`Paid via Paystack - Ref: ${response.reference}`,'Paid'); },
    onClose: function(){ alert('Payment closed. You can choose Pay on Delivery.'); }
  });
  handler.openIframe();
}

// ========== ADMIN LOGIC ==========
async function loadAdmin(){
  if(!isAdminUser()){
    updateAdminAccess();
    return;
  }
  if(!isSupabaseConfigured()){
    document.getElementById('adminProducts').textContent='Connect your Supabase project in script.js to load products.';
    document.getElementById('ordersList').textContent='Connect your Supabase project in script.js to load orders.';
    return;
  }
  const [{data:prods,error:productsError},{data:orders,error:ordersError}]=await Promise.all([
    client.from('products').select('*').order('created_at',{ascending:false}),
    client.from('orders').select('*').order('created_at',{ascending:false})
  ]);
  if(productsError||ordersError){
    document.getElementById('adminProducts').textContent=productsError
      ? `Could not load products: ${productsError.message}`
      : '';
    document.getElementById('ordersList').textContent=ordersError
      ? `Could not load orders: ${ordersError.message}`
      : '';
    return;
  }
  allProducts=prods; allOrders=orders;
  document.getElementById('totalProducts').innerText=allProducts.length;
  document.getElementById('totalOrders').innerText=allOrders.length;
  const paidTotal=allOrders.filter(o=> (o.payment_status||'').toLowerCase().includes('paid')).reduce((s,o)=>s+Number(o.total),0);
  document.getElementById('totalPaid').innerText='GHS '+paidTotal.toLocaleString();
  renderAdminProducts(); renderAdminOrders(allOrders);
}
function renderAdminProducts(){
  document.getElementById('adminProducts').innerHTML=allProducts.length?allProducts.map(p=>`
    <div class="property-card admin-product-row">
      <div class="admin-product-details"><b>${p.name}</b><br><small>GHS ${p.price} | Stock: <span style="color:${p.stock<5?'red':'green'}">${p.stock}</span> | ${p.category}</small>
        <div class="admin-image-thumbnails" aria-label="${productImages(p).length} product pictures">${productImages(p).map(image=>`<img src="${image}" alt="Product picture">`).join('')}</div>
      </div>
      <button onclick="deleteProd('${p.id}')" style="background:#ef4444;width:auto;padding:6px 10px;border:0;border-radius:6px;color:white">Delete</button>
    </div>
  `).join(''):'No products yet';
}
function renderAdminOrders(list){
  const el=document.getElementById('ordersList');
  if(!list.length){el.innerHTML='<p>No orders in this filter.</p>';return;}
  el.innerHTML=list.map(o=>{
    const isPaid=(o.payment_status||'').toLowerCase().includes('paid');
    return `<div class="order-card ${isPaid?'paid':'unpaid'}">
      <div style="display:flex;justify-content:space-between">
        <div><b>${o.customer_name}</b> - ${o.customer_phone}<br><small>${o.address||'No address'} â€¢ ${new Date(o.created_at).toLocaleString()}</small></div>
        <div style="text-align:right"><div><span class="${isPaid?'badge-paid':'badge-unpaid'}">${o.payment_status||'Unpaid'}</span></div><div style="margin-top:4px"><span class="${o.status==='Delivered'?'badge-delivered':'badge-new'}">${o.status}</span></div></div>
      </div>
      <div style="margin-top:8px;background:#f8fafc;padding:8px;border-radius:6px;font-size:13px">${o.items.map(i=>`â€¢ ${i.name} x${i.qty} = GHS ${i.price*i.qty}`).join('<br>')}</div>
      <div style="display:flex;justify-content:space-between;margin-top:8px;align-items:center"><b>Total: GHS ${Number(o.total).toLocaleString()}</b>
        <div style="display:flex;gap:6px">
          <a href="https://wa.me/${o.customer_phone.replace(/^0/,'233')}?text=Hello ${encodeURIComponent(o.customer_name)}" target="_blank" style="font-size:12px;background:#22c55e;color:white;padding:6px 10px;border-radius:6px;text-decoration:none">WhatsApp</a>
          <select onchange="updateStatus('${o.id}',this.value)" style="font-size:12px;padding:4px;border-radius:6px"><option ${o.status==='New'?'selected':''}>New</option><option ${o.status==='Called'?'selected':''}>Called</option><option ${o.status==='Paid'?'selected':''}>Paid</option><option ${o.status==='Delivered'?'selected':''}>Delivered</option><option ${o.status==='Cancelled'?'selected':''}>Cancelled</option></select>
          <button onclick="deleteOrder('${o.id}')" style="background:#fee2e2;color:#dc2626;width:auto;padding:4px 8px;font-size:12px;border:0;border-radius:6px">Del</button>
        </div>
      </div></div>`;
  }).join('');
}
function filterOrders(type, btn){
  document.querySelectorAll('.filter-bar button').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  if(type==='all') renderAdminOrders(allOrders);
  else if(type==='paid') renderAdminOrders(allOrders.filter(o=> (o.payment_status||'').toLowerCase().includes('paid')));
  else if(type==='unpaid') renderAdminOrders(allOrders.filter(o=> !(o.payment_status||'').toLowerCase().includes('paid')));
  else renderAdminOrders(allOrders.filter(o=> o.status===type));
}
async function updateStatus(id,newStatus){
  if(!isAdminUser()) return;
  const {error}=await client.from('orders').update({status:newStatus}).eq('id',id);
  if(error){alert(`Could not update order: ${error.message}`);return;}
  loadAdmin();
}
async function deleteProd(id){
  if(!isAdminUser()) return;
  if(confirm('Delete product?')){
    const {error}=await client.from('products').delete().eq('id',id);
    if(error){alert(`Could not delete product: ${error.message}`);return;}
    loadAdmin(); fetchProducts();
  }
}
async function deleteOrder(id){
  if(!isAdminUser()) return;
  if(confirm('Delete order?')){
    const {error}=await client.from('orders').delete().eq('id',id);
    if(error){alert(`Could not delete order: ${error.message}`);return;}
    loadAdmin();
  }
}

// Init
document.addEventListener('DOMContentLoaded', ()=>{
  fetchProducts();
  document.getElementById('trackingForm').addEventListener('submit',trackOrder);
  const heroSlides=Array.from(document.querySelectorAll('.hero-slide'));
  if(heroSlides.length>1&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    let activeSlide=0;
    window.setInterval(()=>{
      if(!document.getElementById('shopView').classList.contains('active')) return;
      heroSlides[activeSlide].classList.remove('active');
      activeSlide=(activeSlide+1)%heroSlides.length;
      heroSlides[activeSlide].classList.add('active');
    },4500);
  }
  document.getElementById('adminLoginForm').addEventListener('submit',signInAdmin);
  client.auth.onAuthStateChange((_event,session)=>{
    currentUser=session?.user||null;
    updateAdminAccess();
    if(!isAdminUser()){
      allOrders=[];
      document.getElementById('totalOrders').textContent='0';
      document.getElementById('totalPaid').textContent='GHS 0';
      document.getElementById('adminProducts').textContent='';
      document.getElementById('ordersList').textContent='';
    }else if(document.getElementById('adminView').classList.contains('active')){
      loadAdmin();
    }
  });
  client.auth.getSession().then(({data,error})=>{
    if(error){
      updateAdminAccess(`Could not check the current sign-in: ${error.message}`);
      return;
    }
    currentUser=data.session?.user||null;
    updateAdminAccess();
    if(isAdminUser()&&document.getElementById('adminView').classList.contains('active')) loadAdmin();
  });
  const addForm=document.getElementById('addForm');
  if(addForm){
    const detailRows=document.getElementById('productDetailRows');
    document.getElementById('addProductDetail').addEventListener('click',addProductDetailRow);
    detailRows.addEventListener('click',event=>{
      const removeButton=event.target.closest('.remove-detail');
      if(!removeButton) return;
      const rows=detailRows.querySelectorAll('.product-detail-row');
      if(rows.length===1){
        rows[0].querySelectorAll('input').forEach(input=>input.value='');
      }else{
        removeButton.closest('.product-detail-row').remove();
      }
    });
    const imageInput=document.getElementById('pImages');
    const imagePreview=document.getElementById('pImagesPreview');
    const imageHelp=document.getElementById('pImagesHelp');
    const updateImagePreview=()=>{
      imagePreview.replaceChildren();
      const files=Array.from(imageInput.files);
      imageHelp.textContent=files.length
        ? `${files.length} of 4 pictures selected. Select them together in the file picker.`
        : 'Select up to 4 images. Select all pictures together in the file picker.';
      files.forEach((file,index)=>{
        const tile=document.createElement('div');
        tile.className='selected-image';
        const image=document.createElement('img');
        image.src=URL.createObjectURL(file);
        image.alt=`Selected product picture ${index+1}`;
        image.onload=()=>URL.revokeObjectURL(image.src);
        const number=document.createElement('span');
        number.textContent=`${index+1}`;
        tile.append(image,number);
        imagePreview.append(tile);
      });
    };
    imageInput.addEventListener('change',()=>{
      if(imageInput.files.length>4){
        alert('Choose no more than 4 product pictures.');
        imageInput.value='';
      }
      updateImagePreview();
    });
    addForm.addEventListener('submit',async(e)=>{
      e.preventDefault();
      if(!isAdminUser()){
        updateAdminAccess();
        showView('admin');
        return;
      }
      if(!isSupabaseConfigured()){
        showSupabaseSetupMessage();
        return;
      }
      const price=Number(document.getElementById('pPrice').value);
      const oldPrice=document.getElementById('pOld').value?Number(document.getElementById('pOld').value):null;
      if(!Number.isFinite(price)||price<=0||oldPrice!==null&&(!Number.isFinite(oldPrice)||oldPrice<0)){
        alert('Enter a product price greater than zero and a valid old price.');
        return;
      }
      if(!imageInput.files.length||imageInput.files.length>4){
        alert('Choose between 1 and 4 product pictures.');
        return;
      }
      try{
        const images=await Promise.all(Array.from(imageInput.files,file=>resizeProductImage(file)));
        const details=Array.from(detailRows.querySelectorAll('.product-detail-row'))
          .map(row=>({
            label:row.querySelector('.product-detail-label').value.trim(),
            value:row.querySelector('.product-detail-value').value.trim()
          }))
          .filter(detail=>detail.label&&detail.value);
        const {error}=await client.from('products').insert({
          name:document.getElementById('pName').value, price, old_price:oldPrice,
          category:document.getElementById('pCat').value, size:document.getElementById('pSize').value, stock:Number(document.getElementById('pStock').value||20),
          image_url:JSON.stringify(images),
          description:details.length?JSON.stringify({format:'product-details-v1',details}):''
        });
        if(error){alert(error.message);return;}
        alert(`Product Added with ${images.length} picture${images.length===1?'':'s'}!`);
        e.target.reset();
        detailRows.innerHTML='<div class="product-detail-row"><input class="product-detail-label" aria-label="Detail name" placeholder="e.g. Material"><input class="product-detail-value" aria-label="Detail value" placeholder="e.g. 100% cotton"><button class="remove-detail" type="button" aria-label="Remove detail">×</button></div>';
        updateImagePreview();
        loadAdmin();
      }catch(error){
        alert(`Could not add product: ${error.message}`);
      }
    });
  }
  const search=document.getElementById('search');
  if(search) search.addEventListener('input',e=>{ const q=e.target.value.toLowerCase(); renderShop(allProducts.filter(p=>p.name.toLowerCase().includes(q))); });
  const catFilter=document.getElementById('catFilter');
  if(catFilter) catFilter.addEventListener('change',e=>{ const v=e.target.value; renderShop(v?allProducts.filter(p=>p.category===v):allProducts); });
});

function resizeProductImage(file){
  return new Promise((resolve,reject)=>{
    if(!file.type.startsWith('image/')){reject(new Error('Please select image files only.'));return;}
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error(`Could not read ${file.name}.`));
    reader.onload=()=>{
      const image=new Image();
      image.onerror=()=>reject(new Error(`Could not open ${file.name}.`));
      image.onload=()=>{
        const scale=Math.min(1,900/Math.max(image.naturalWidth,image.naturalHeight));
        const canvas=document.createElement('canvas');
        canvas.width=Math.round(image.naturalWidth*scale);
        canvas.height=Math.round(image.naturalHeight*scale);
        const context=canvas.getContext('2d');
        if(!context){reject(new Error('Your browser could not process the selected images.'));return;}
        context.fillStyle='#fff';
        context.fillRect(0,0,canvas.width,canvas.height);
        context.drawImage(image,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/jpeg',0.74));
      };
      image.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}