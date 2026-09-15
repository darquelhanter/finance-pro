/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleInsights } from '../_lib/handlers';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return handleInsights(req, res);
}
