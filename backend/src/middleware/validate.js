import { HttpError } from '../utils.js';

/** Validate req.body / req.query against a zod schema and replace it with the parsed value. */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source] ?? {});
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    throw new HttpError(400, details[0]?.message || 'Invalid input', details);
  }
  if (source === 'query') req.validQuery = result.data;
  else req[source] = result.data;
  next();
};
