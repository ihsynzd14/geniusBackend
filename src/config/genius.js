const env = process.env.NODE_ENV || 'uat';
const { geniusConfig } = await import(`./genius.${env}.js`);
export { geniusConfig }; 