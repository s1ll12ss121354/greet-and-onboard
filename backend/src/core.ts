import { PrismaClient } from "@prisma/client"; import IORedis from "ioredis"; import { Queue as BullQueue } from "bullmq";
export const prisma=new PrismaClient(); export const redis=new IORedis(process.env.REDIS_URL!); export const jobs=new BullQueue("recorn", {connection:redis});
export const now=()=>new Date(); export const err=(status:number,message:string)=>Object.assign(new Error(message),{status});
export const requireEnv=(k:string)=>{const v=process.env[k];if(!v)throw new Error("Missing env "+k);return v};
