/** Valide body/query/params avec un schéma zod ; remplace par les valeurs nettoyées. */
const validate = (schemas) => (req, _res, next) => {
  try {
    for (const part of ['params', 'query', 'body']) {
      if (schemas[part]) req[part] = schemas[part].parse(req[part] ?? {});
    }
    next();
  } catch (e) { next(e); }
};
module.exports = { validate };
