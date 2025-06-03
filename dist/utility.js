export const dateFormat = (date, options = {
    month: 'numeric', day: 'numeric'
}) => {
    options.timeZone = process.env.TZ || 'UTC';
    return new Date(date).toLocaleDateString('en-US', options);
};
//# sourceMappingURL=utility.js.map