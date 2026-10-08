import {formats,findMatches} from "./matchmaking.service.js";
const tick=async()=>{for(const format of Object.keys(formats)){try{await findMatches(format)}catch(e){console.error("matchmaker",format,e)}}};
setInterval(tick,500); await tick(); console.log("Recorn matchmaking worker started");
