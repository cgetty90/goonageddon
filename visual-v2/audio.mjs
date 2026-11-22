// Intentionally silent in the temporary visual-only candidate.
export function createAudio(){
  const noop=()=>{};
  return {unlock:noop,refresh:noop,cue:noop,setSilenced:noop,setScore:noop};
}
