// Unicode mathematical alphabets contain legacy letter exceptions.
const alphabet = (upper, lower, digit, exceptions = {}) => text => Array.from(text, char => {
  if (exceptions[char]) return exceptions[char];
  const code = char.codePointAt(0);
  if (code >= 65 && code <= 90) return String.fromCodePoint(upper + code - 65);
  if (code >= 97 && code <= 122) return String.fromCodePoint(lower + code - 97);
  if (digit !== null && code >= 48 && code <= 57) return String.fromCodePoint(digit + code - 48);
  return char;
}).join('');
const mark = combining => text => Array.from(text, char => /[\p{L}\p{N}]/u.test(char) ? char + combining : char).join('');
export const textStyles = [
  {id:'bold', name:'Bold', group:'essentials', convert:alphabet(0x1d400,0x1d41a,0x1d7ce)},
  {id:'italic', name:'Italic', group:'essentials', convert:alphabet(0x1d434,0x1d44e,null,{h:'ℎ'})},
  {id:'sans-bold', name:'Sans bold', group:'essentials', convert:alphabet(0x1d5d4,0x1d5ee,0x1d7ec)},
  {id:'bold-italic', name:'Bold italic', group:'essentials', convert:alphabet(0x1d468,0x1d482,null)},
  {id:'script', name:'Script', group:'expressive', convert:alphabet(0x1d49c,0x1d4b6,null,{B:'ℬ',E:'ℰ',F:'ℱ',H:'ℋ',I:'ℐ',L:'ℒ',M:'ℳ',R:'ℛ',e:'ℯ',g:'ℊ',o:'ℴ'})},
  {id:'fraktur', name:'Fraktur', group:'expressive', convert:alphabet(0x1d504,0x1d51e,null,{C:'ℭ',H:'ℌ',I:'ℑ',R:'ℜ',Z:'ℨ'})},
  {id:'monospace', name:'Monospace', group:'essentials', convert:alphabet(0x1d670,0x1d68a,0x1d7f6)},
  {id:'double', name:'Double-struck', group:'expressive', convert:alphabet(0x1d538,0x1d552,0x1d7d8,{C:'ℂ',H:'ℍ',N:'ℕ',P:'ℙ',Q:'ℚ',R:'ℝ',Z:'ℤ'})},
  {id:'small-caps', name:'Small caps', group:'expressive', convert:text => text.replace(/[a-z]/g, char => Array.from('ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ')[char.charCodeAt(0)-97])},
  {id:'underline', name:'Underline', group:'decorative', convert:mark('\u0332')},
  {id:'strike', name:'Strikethrough', group:'decorative', convert:mark('\u0336')},
  {id:'bubble', name:'Bubble', group:'decorative', convert:alphabet(0x24b6,0x24d0,null)},
  {id:'wide', name:'Fullwidth', group:'decorative', convert:text => text.replace(/[!-~]/g, char => String.fromCodePoint(char.charCodeAt(0)+0xfee0))},
  {id:'plain', name:'Plain text', group:'essentials', convert:text => text},
];
