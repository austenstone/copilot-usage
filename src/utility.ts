export const dateFormat = (date: string, options: Intl.DateTimeFormatOptions = {
  month: 'numeric', day: 'numeric'
}): string => {
  options.timeZone = process.env.TZ || 'UTC';
  return new Date(date).toLocaleDateString('en-US', options);
};