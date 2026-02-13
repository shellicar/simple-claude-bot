import { DateTimeFormatter } from '@js-joda/core';
import { Locale } from '@js-joda/locale_en';

export const timestampFormatter = DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy 'at' HH:mm:ss VV (xxx)").withLocale(Locale.ENGLISH);
