import { useRef, useState, type CSSProperties, type PointerEvent, type Ref } from "react";
import { ArrowRight, Check } from "lucide-react";
type Props={onCommit:()=>void;disabled?:boolean;buttonRef?:Ref<HTMLButtonElement>};
export default function WelcomeCommitButton({onCommit,disabled=false,buttonRef}:Props){
 const [progress,setProgress]=useState(0);
 const [committed,setCommitted]=useState(false);
 const [dragging,setDragging]=useState(false);
 const progressRef=useRef(0);
 const origin=useRef<{x:number;id:number}|null>(null);
 const moved=useRef(false);
 const suppressClick=useRef(false);
 const didCommit=useRef(false);
 function updateProgress(value:number){progressRef.current=value;setProgress(value)}
 function commit(){if(disabled||didCommit.current)return;didCommit.current=true;updateProgress(1);setCommitted(true);onCommit()}
 function down(e:PointerEvent<HTMLButtonElement>){if(disabled||didCommit.current||e.button!==0)return;origin.current={x:e.clientX,id:e.pointerId};moved.current=false;suppressClick.current=false;setDragging(true);e.currentTarget.setPointerCapture?.(e.pointerId)}
 function move(e:PointerEvent<HTMLButtonElement>){const p=origin.current;if(!p||p.id!==e.pointerId)return;const delta=e.clientX-p.x;if(Math.abs(delta)>8)moved.current=true;const w=e.currentTarget.getBoundingClientRect().width||278;updateProgress(Math.min(1,Math.max(0,delta/Math.max(1,w-52))))}
 function up(e:PointerEvent<HTMLButtonElement>){const p=origin.current;if(!p||p.id!==e.pointerId)return;origin.current=null;setDragging(false);e.currentTarget.releasePointerCapture?.(e.pointerId);if(moved.current){suppressClick.current=true;if(progressRef.current>=.76)commit();else updateProgress(0)}}
 return <button ref={buttonRef} type="button" className="hts-welcome-start hts-commit" aria-label="Démarrer HébergTonServ" disabled={disabled||committed} data-committed={committed?"true":undefined} data-dragging={dragging?"true":undefined} style={{"--hts-slide-progress":progress} as CSSProperties}
 onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{origin.current=null;setDragging(false);suppressClick.current=true;updateProgress(0)}} onClick={e=>{if(suppressClick.current){suppressClick.current=false;e.preventDefault();return}commit()}}>
  <span className="hts-commit-fill" aria-hidden="true"/>
  <span className="hts-commit-label">{committed?"Ouverture…":"Démarrer"}</span>
  <span className="hts-commit-handle" aria-hidden="true">{committed?<Check className="size-5"/>:<ArrowRight className="size-5"/>}</span>
  <span className="hts-commit-particles" aria-hidden="true"><i/><i/><i/><i/><i/><i/></span>
 </button>;
}
