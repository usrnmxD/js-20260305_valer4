/**
 * omit - creates an object composed of enumerable property fields
 * @param {object} obj - the source object
 * @param {...string} fields - the properties paths to omit
 * @returns {object} - returns the new object
 */
export const omit = (main_obj, ...fields) => {
 const obj = {}; 
    Object.entries(main_obj).forEach(([key, value]) => {
        if (!fields.includes(key)) {
            obj[key] = value; 
        }
    });
    return obj;
};