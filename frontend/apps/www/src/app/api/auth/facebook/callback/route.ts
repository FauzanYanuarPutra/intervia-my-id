import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/session';
import { authSecurityHeaders, enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { shouldUseSecureCookies } from '@/lib/server/forwardCookies';

function origin(req: NextRequest) {
  const host=req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const proto=req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  return host&&proto ? proto+'://'+host : req.nextUrl.origin;
}
export async function GET(req: NextRequest) {
  const secure=shouldUseSecureCookies(req);
  const base=process.env.NEXT_PUBLIC_WWW_URL||process.env.NEXT_PUBLIC_APP_URL||origin(req);
  const locale=req.cookies.get('NEXT_LOCALE')?.value||'id';
  const fail=(code:string)=>{const r=NextResponse.redirect(new URL('/'+locale+'/login?error='+encodeURIComponent(code),base));r.cookies.set('facebook_oauth_state','',{httpOnly:true,secure,sameSite:'lax',path:'/',maxAge:0});return r;};
  try {
    const security=await enforceAuthRouteSecurity(req,{routeKey:'facebook-oauth-callback',ipLimit:180,deviceLimit:120,windowSeconds:900});
    if(!security.ok)return security.response;
    const code=req.nextUrl.searchParams.get('code');
    const state=req.nextUrl.searchParams.get('state')||'';
    if(!code||state!==(req.cookies.get('facebook_oauth_state')?.value||''))return fail('oauth_state_invalid');
    let parsed:any; try{parsed=JSON.parse(Buffer.from(state,'base64url').toString());}catch{return fail('oauth_state_invalid');}
    if(parsed.nonce!==(req.cookies.get('facebook_oauth_state')?.value||''))return fail('oauth_state_invalid');
    const appId=process.env.FACEBOOK_APP_ID, appSecret=process.env.FACEBOOK_APP_SECRET;
    const version=process.env.FACEBOOK_GRAPH_VERSION||'v24.0';
    const redirect=process.env.WWW_FACEBOOK_REDIRECT_URI||base+'/api/auth/facebook/callback';
    if(!appId||!appSecret)return fail('oauth_not_configured');
    const tokenRes=await fetch('https://graph.facebook.com/'+version+'/oauth/access_token?'+new URLSearchParams({client_id:appId,client_secret:appSecret,redirect_uri:redirect,code}));
    if(!tokenRes.ok)return fail('token_exchange_failed');
    const token=await tokenRes.json() as {access_token?:string};
    if(!token.access_token)return fail('token_exchange_failed');
    const backend=await fetch((process.env.INTERNAL_API_URL||'http://identity_service:8080')+'/auth/oauth/facebook',{method:'POST',headers:{'Content-Type':'application/json',...authSecurityHeaders(security)},body:JSON.stringify({access_token:token.access_token})});
    if(backend.status===409)return fail('account_exists_use_existing_login');
    if(!backend.ok)return fail('backend_failed');
    const data=await backend.json() as any;
    if(!data.access_token||!data.user?.id)return fail('backend_invalid_response');
    const session=await createSession(data.user.id,{userAgent:req.headers.get('user-agent')||'Unknown',ipAddress:req.headers.get('x-forwarded-for')||req.headers.get('x-real-ip')||'127.0.0.1',sessionId:data.session_id});
    const target=typeof parsed.callbackUrl==='string'&&parsed.callbackUrl.startsWith('/')?parsed.callbackUrl:'/id/profile';
    const response=NextResponse.redirect(new URL(target,base));
    response.cookies.set('access_token',data.access_token,{httpOnly:true,secure,sameSite:'lax',maxAge:3600});
    if(data.refresh_token)response.cookies.set('refresh_token',data.refresh_token,{httpOnly:true,secure,sameSite:'lax',maxAge:30*24*3600});
    response.cookies.set('session_id',data.session_id||session.id,{secure,sameSite:'lax',maxAge:30*24*3600});
    response.cookies.set('auth_present','1',{httpOnly:false,secure,sameSite:'lax',path:'/',maxAge:30*24*3600});
    response.cookies.set('facebook_oauth_state','',{httpOnly:true,secure,sameSite:'lax',path:'/',maxAge:0});
    return response;
  } catch { return fail('oauth_error'); }
}
