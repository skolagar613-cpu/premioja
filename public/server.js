const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const ASAAS_BASE = process.env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com/v3';
const isAsaasConfigured = Boolean(process.env.ASAAS_API_KEY);
const sessions = new Map();

function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { products: [
    { id: 'p-fone', name: 'Fone Bluetooth', description: 'Som sem fio para o dia a dia.', price: 89.90, active: true },
    { id: 'p-relogio', name: 'Relógio esportivo', description: 'Visual moderno para sua rotina.', price: 119.90, active: true },
    { id: 'p-mochila', name: 'Mochila urbana', description: 'Prática para trabalho e estudos.', price: 149.90, active: true }
  ], orders: [], processedEvents: [] }; }
}
let db = readData();
function saveData() { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); }
function cleanProduct(p) { return { id:p.id, name:p.name, description:p.description || '', price:p.price }; }
function auth(req,res,next) {
  const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  const session=sessions.get(token);
  if(!session || session.expires < Date.now()) return res.status(401).json({error:'Sessão administrativa inválida.'});
  next();
}
app.use(express.static(path.join(__dirname,'public')));
app.use(express.json({limit:'1mb'}));

app.get('/api/health',(req,res)=>res.json({ok:true,mode:isAsaasConfigured?'asaas-configured':'no-payment-provider'}));
app.get('/api/products',(req,res)=>res.json(db.products.filter(p=>p.active).map(cleanProduct)));

app.post('/api/orders', async (req,res)=>{
  try {
    const {name,email,cpf,items}=req.body||{};
    if(typeof name!=='string'||name.trim().length<2) return res.status(400).json({error:'Informe seu nome.'});
    if(typeof email!=='string'||!/^\\S+@\\S+\\.\\S+$/.test(email)) return res.status(400).json({error:'E-mail inválido.'});
    const digits=String(cpf||'').replace(/\\D/g,'');
    if(digits.length!==11) return res.status(400).json({error:'Informe CPF com 11 dígitos.'});
    if(!Array.isArray(items)||!items.length||items.length>30) return res.status(400).json({error:'Carrinho vazio ou inválido.'});
    let lines=[],total=0;
    for(const item of items){
      const p=db.products.find(x=>x.id===item.productId&&x.active);
      const qty=Number(item.quantity);
      if(!p||!Number.isInteger(qty)||qty<1||qty>20) return res.status(400).json({error:'Produto ou quantidade inválida.'});
      lines.push({productId:p.id,name:p.name,price:p.price,quantity:qty});
      total+=Math.round(p.price*qty*100)/100;
    }
    if(total<=0||total>100000) return res.status(400).json({error:'Total fora do limite permitido.'});
    const order={id:'PJ-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomBytes(3).toString('hex').toUpperCase(),name:name.trim(),email:email.trim().toLowerCase(),cpf:digits,items:lines,total:Math.round(total*100)/100,status:'PENDING',createdAt:new Date().toISOString(),paymentId:null};
    let pix=null;
    if(isAsaasConfigured){
      const customerResp=await fetch(`${ASAAS_BASE}/customers`,{method:'POST',headers:{'Content-Type':'application/json','access_token':process.env.ASAAS_API_KEY},body:JSON.stringify({name:order.name,email:order.email,cpfCnpj:order.cpf,externalReference:order.id})});
      const customer=await customerResp.json();
      if(!customerResp.ok) return res.status(502).json({error:customer.errors?.[0]?.description||'Não foi possível cadastrar cliente no provedor.'});
      const paymentResp=await fetch(`${ASAAS_BASE}/payments`,{method:'POST',headers:{'Content-Type':'application/json','access_token':process.env.ASAAS_API_KEY},body:JSON.stringify({customer:customer.id,billingType:'PIX',value:order.total,dueDate:new Date(Date.now()+86400000).toISOString().slice(0,10),description:`Pedido ${order.id}`,externalReference:order.id})});
      const payment=await paymentResp.json();
      if(!paymentResp.ok) return res.status(502).json({error:payment.errors?.[0]?.description||'Não foi possível criar cobrança Pix.'});
      order.paymentId=payment.id;
      const qrResp=await fetch(`${ASAAS_BASE}/payments/${payment.id}/pixQrCode`,{headers:{'access_token':process.env.ASAAS_API_KEY}});
      const qr=await qrResp.json();
      if(qrResp.ok) pix={encodedImage:qr.encodedImage||null,payload:qr.payload||null,expirationDate:qr.expirationDate||null};
    }
    db.orders.unshift(order);saveData();
    res.status(201).json({order:{id:order.id,total:order.total,status:order.status,createdAt:order.createdAt},pix});
  } catch(e) { console.error(e);res.status(500).json({error:'Erro interno ao criar pedido.'}); }
});

app.get('/api/my-orders',(req,res)=>{
  const email=String(req.query.email||'').trim().toLowerCase();
  if(!/^\\S+@\\S+\\.\\S+$/.test(email)) return res.status(400).json({error:'E-mail inválido.'});
  // Minimal prototype lookup. Production should use a signed order link or authenticated account.
  res.json(db.orders.filter(o=>o.email===email).map(o=>({id:o.id,email:o.email,total:o.total,status:o.status,createdAt:o.createdAt,items:o.items})));
});

app.post('/api/admin/login',(req,res)=>{
  if(!process.env.ADMIN_PASSWORD) return res.status(503).json({error:'ADMIN_PASSWORD ainda não foi configurada no servidor.'});
  if(!req.body||req.body.password!==process.env.ADMIN_PASSWORD) return res.status(401).json({error:'Senha incorreta.'});
  const token=crypto.randomBytes(32).toString('hex');
  sessions.set(token,{expires:Date.now()+8*60*60*1000});
  res.json({token,expiresIn:28800});
});
app.get('/api/admin/summary',auth,(req,res)=>res.json({orders:db.orders.map(o=>({id:o.id,name:o.name,email:o.email,total:o.total,status:o.status,createdAt:o.createdAt,items:o.items})),products:db.products.map(cleanProduct)}));
app.post('/api/admin/products',auth,(req,res)=>{
  const name=String(req.body?.name||'').trim(),description=String(req.body?.description||'').trim(),price=Number(req.body?.price);
  if(name.length<2||name.length>100||!Number.isFinite(price)||price<=0||price>100000) return res.status(400).json({error:'Nome ou preço inválido.'});
  const p={id:'p-'+crypto.randomBytes(6).toString('hex'),name,description,price:Math.round(price*100)/100,active:true};
  db.products.unshift(p);saveData();res.status(201).json(cleanProduct(p));
});

// Asaas sends notifications at least once. Validate the secret token and process each event idempotently.
app.post('/api/webhooks/asaas',async(req,res)=>{
  const configured=process.env.ASAAS_WEBHOOK_TOKEN;
  const incoming=req.headers['asaas-access-token'];
  if(!configured||!incoming||incoming!==configured) return res.status(401).send('Unauthorized');
  const event=req.body||{}, eventId=String(event.id||'');
  if(!eventId) return res.status(400).send('Missing event id');
  if(db.processedEvents.includes(eventId)) return res.status(200).send('Already processed');
  const payment=event.payment||{};
  const order=db.orders.find(o=>o.paymentId===payment.id||o.id===payment.externalReference);
  if(order){
    if(event.event==='PAYMENT_RECEIVED'||event.event==='PAYMENT_CONFIRMED') order.status='RECEIVED';
    else if(event.event==='PAYMENT_OVERDUE') order.status='OVERDUE';
    else if(event.event==='PAYMENT_REFUNDED'||event.event==='PAYMENT_DELETED') order.status=event.event==='PAYMENT_REFUNDED'?'REFUNDED':'CANCELED';
  }
  db.processedEvents.push(eventId);
  if(db.processedEvents.length>5000) db.processedEvents=db.processedEvents.slice(-2500);
  saveData();res.status(200).send('OK');
});

app.listen(PORT,()=>console.log(`PrêmioJá Store disponível na porta ${PORT}. Asaas: ${isAsaasConfigured?'configurado':'não configurado (sem cobranças reais)'}`));
