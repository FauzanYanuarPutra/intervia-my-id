import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { shouldUseSecureCookies } from '@/lib/server/forwardCookies';

function origin(req: NextRequest) {
  const host=req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const proto=req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  return host&&proto ? proto+'://'+host : req.nextUrl.origin;
}
export async function GET(req: NextRequest) {
  const security=await enforceAuthRouteSecurity(req,{routeKey:'facebook-oauth-start',ipLimit:120,deviceLimit:80,windowSeconds:900});
  if(!security.ok)return security.response;
  const appId=process.env.FACEBOOK_APP_ID;
  const base=process.env.NEXT_PUBLIC_WWW_URL||process.env.NEXT_PUBLIC_APP_URL||origin(req);
  const callback=process.env.WWW_FACEBOOK_REDIRECT_URI||base+'/api/auth/facebook/callback';
  const callbackUrl=req.nextUrl.searchParams.get('callbackUrl')||'/id/profile';
  const locale=req.cookies.get('NEXT_LOCALE')?.value||'id';
  if(!appId)return NextResponse.redirect(new URL('/'+locale+'/login?error=oauth_not_configured',base));
  const nonce=randomUUID();
  const state=Buffer.from(JSON.stringify({callbackUrl,nonce})).toString('base64url');
  const version=process.env.FACEBOOK_GRAPH_VERSION||'v24.0';
  const params=new URLSearchParams({client_id:appId,redirect_uri:callback,response_type:'code',scope:'email,public_profile',state});
  const response=NextResponse.redirect('https://www.facebook.com/'+version+'/dialog/oauth?'+params.toString());
  response.cookies.set('facebook_oauth_state',nonce,{httpOnly:true,secure:shouldUseSecureCookies(req),sameSite:'lax',path:'/',maxAge:600});
  return response;
}
