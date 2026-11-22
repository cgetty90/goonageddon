const names=Object.freeze({
  'alien-boss':'commander','card-a':'a','card-k':'k','card-q':'q',
  'card-j':'j','card-10':'ten','scatter-ufo':'scatter','wild-base':'wild'
});
export function symbolArt(asset){
  return 'assets/visual/symbols/'+(names[asset]??asset)+'.webp';
}

