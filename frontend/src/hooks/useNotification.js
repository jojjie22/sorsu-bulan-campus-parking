import {useCallback,useEffect,useState} from 'react';

/** Timed, accessible feedback after API actions. */
export function useNotification(){
  const [toast,setToast]=useState(null);
  const notify=useCallback((msg,err=false)=>setToast({msg,err,time:Date.now()}),[]);
  useEffect(()=>{if(!toast)return;const timeout=setTimeout(()=>setToast(null),4600);return()=>clearTimeout(timeout)},[toast]);
  return {toast,notify,dismiss:()=>setToast(null)};
}
