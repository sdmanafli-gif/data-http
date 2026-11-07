-- ============================================================
-- 47: Sənədlər qovluğu (Mobideal) bağlanır
--
-- Əvvəl: faylın tam linkini bilən hər kəs (login olmadan) faylı yükləyə bilirdi.
-- İndi: fayl yalnız saytda login olmuş işçiyə müvəqqəti linklə açılır.
--
-- ⚠️ YALNIZ sayt yeni versiyaya keçəndən (merge) SONRA işlədin.
--    Köhnə sayt «açıq link» işlədir — əvvəl işlətsəniz, köhnə saytda fayllar açılmaz.
--
-- Fayllar silinmir, yerində qalır. Geri qaytarmaq: aşağıdakı sətirdə false → true.
-- Qəbz qovluğu («q») toxunulmur — müştəriyə göndərilən qəbz linkləri işləməyə davam edir.
-- ============================================================

update storage.buckets set public = false where id = 'Mobideal';

-- Yoxlama: public = false olmalıdır
select id, public from storage.buckets where id in ('Mobideal', 'mobideal-sexsi', 'q') order by id;
