import type { Request, Response } from 'express';
import { smartLinkRedirectHandler } from '../../smart-links-service';

export default async function handler(req:Request,res:Response){
  req.params = { ...req.params, code: String(req.query.code || '') };
  return smartLinkRedirectHandler(req,res);
}
