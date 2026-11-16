"use client";
import {FormEvent,useState} from "react";

export default function ContactForm(){
  const [status,setStatus]=useState<"idle"|"sending"|"sent"|"error">("idle");
  const [error,setError]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setStatus("sending");setError("");
    const form=event.currentTarget;
    const data=new FormData(form);
    try{
      const response=await fetch("/api/contact",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.fromEntries(data))});
      const result:any=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||"Meddelandet kunde inte skickas.");
      form.reset();setStatus("sent");
    }catch(reason){setError(reason instanceof Error?reason.message:"Meddelandet kunde inte skickas.");setStatus("error")}
  }
  return <form className="footerContactForm" onSubmit={submit}>
    <b>Skicka ett meddelande</b>
    <div><label><span>Namn *</span><input name="name" required autoComplete="name"/></label><label><span>E-post *</span><input name="email" type="email" required autoComplete="email"/></label></div>
    <label><span>Telefon</span><input name="phone" type="tel" autoComplete="tel"/></label>
    <label><span>Meddelande *</span><textarea name="message" required rows={3}/></label>
    <button type="submit" disabled={status==="sending"}>{status==="sending"?"Skickar…":"Skicka meddelande"}</button>
    {status==="sent"&&<p className="footerFormSuccess" role="status">Tack! Ditt meddelande är skickat.</p>}
    {status==="error"&&<p className="footerFormError" role="alert">{error}</p>}
  </form>
}
