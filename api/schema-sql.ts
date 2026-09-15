/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleSchemaSql } from './_lib/handlers.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return handleSchemaSql(req, res);
}
