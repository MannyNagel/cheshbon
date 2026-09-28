# Jewish calendar source

Daily Cheshbon uses the official Hebcal Jewish Calendar REST API for diaspora Yom Tov dates:

- https://www.hebcal.com/home/195/jewish-calendar-rest-api
- `i=off` selects the diaspora calendar.
- Only full Yom Tov dates are used for the Shabbos routine. Erev Yom Tov, Chol Hamoed, Hoshana Raba, Purim, Chanukah, and fast days are excluded.

The app keeps a deterministic Hebrew-date fallback for offline use. The fallback covers Rosh Hashanah, Yom Kippur, the first two and final two diaspora days of Pesach, the first two days of Sukkot, Shmini Atzeret, Simchat Torah, and both diaspora days of Shavuot.

Reviews use civil dates. A Yom Tov beginning at sunset is therefore represented by the following civil daytime date. For example, Shmini Atzeret beginning Friday night activates the Shabbos routine for Shabbos, and Simchat Torah keeps it active for Sunday until nightfall.
