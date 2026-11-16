import ActivatePartner from '../../activate-partner';
export default async function Page({params}:{params:Promise<{code:string}>}){const {code}=await params;return <ActivatePartner code={code}/>;}
