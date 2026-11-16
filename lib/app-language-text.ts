import {messages} from './customer-i18n';
import {appTranslations} from './app-translations';
export function translateAppText(text:string,lang:string){
 if(lang==='sv')return text;
 const locale=lang==='de-CH'?'de':lang;
 const exact=appTranslations[locale]?.[text]||appTranslations['en-US']?.[text];
 if(exact)return lang==='de-CH'?exact.replaceAll('ß','ss'):exact;
 const key=Object.keys(messages.sv).find(k=>messages.sv[k]===text);
 return key?messages[locale]?.[key]||messages['en-US']?.[key]||text:text;
}
