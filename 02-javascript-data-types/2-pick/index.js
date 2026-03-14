/**
 * pick - Creates an object composed of the picked object properties:
 * @param {object} obj - the source object
 * @param {...string} fields - the properties paths to pick
 * @returns {object} - returns the new object
 */
export const pick = (main_obj, ...fields) => {
    const obj = {}; 
    Object.entries(main_obj).forEach(([key, value]) => {
        if (fields.includes(key)) {
            obj[key] = value; 
        }
    });
    return obj;
}