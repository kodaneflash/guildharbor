ALTER TABLE "vouches" DROP CONSTRAINT "vouches_listing_thread_id_marketplace_listings_thread_id_fk";
--> statement-breakpoint
UPDATE "vouches" SET "thread_id" = "listing_thread_id" WHERE "thread_id" IS NULL AND "listing_thread_id" IS NOT NULL;
--> statement-breakpoint
DROP TABLE "marketplace_listings";
--> statement-breakpoint
ALTER TABLE "threads" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "threads" ALTER COLUMN "type" SET DEFAULT 'discussion'::text;--> statement-breakpoint
UPDATE "threads" SET "type" = 'discussion' WHERE "type" IN ('selling', 'buying', 'service');--> statement-breakpoint
DROP TYPE "public"."thread_type";--> statement-breakpoint
CREATE TYPE "public"."thread_type" AS ENUM('discussion', 'announcement');--> statement-breakpoint
ALTER TABLE "threads" ALTER COLUMN "type" SET DEFAULT 'discussion'::"public"."thread_type";--> statement-breakpoint
ALTER TABLE "threads" ALTER COLUMN "type" SET DATA TYPE "public"."thread_type" USING "type"::"public"."thread_type";--> statement-breakpoint
DROP INDEX "vouches_listing_reference_unique";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "membership_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "vouches" DROP COLUMN "listing_thread_id";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_membership_status_valid" CHECK ("users"."membership_status" in ('pending', 'approved', 'rejected'));--> statement-breakpoint
DROP TYPE "public"."listing_status";

--> statement-breakpoint
CREATE FUNCTION normalize_forum_username() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.username IS NOT NULL THEN
    NEW.username := lower(trim(NEW.username::text));
    IF NEW.username::text !~ '^[a-z0-9_.]{3,30}$' OR NEW.username::text = ANY(ARRAY['admin','administrator','api','auth','guildharbor','help','moderator','root','security','staff','support','system','deleted','members','forums']) THEN
      RAISE EXCEPTION 'Invalid or reserved username' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER users_normalize_username BEFORE INSERT OR UPDATE OF username ON users FOR EACH ROW EXECUTE FUNCTION normalize_forum_username();
--> statement-breakpoint
INSERT INTO roles (key, name, permissions) VALUES ('member', 'Member', ARRAY['forum.read','thread.create','thread.reply','thread.edit.own','message.send','report.create','reputation.give']) ON CONFLICT (key) DO NOTHING;
--> statement-breakpoint
DROP TRIGGER users_create_profile ON users;
--> statement-breakpoint
DROP FUNCTION create_profile_for_new_user();
--> statement-breakpoint
CREATE FUNCTION provision_forum_member() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE member_role uuid;
BEGIN
  SELECT id INTO STRICT member_role FROM roles WHERE key = 'member';
  INSERT INTO profiles (user_id, display_name, primary_role_id) VALUES (NEW.id, NEW.username, member_role);
  INSERT INTO user_roles (user_id, role_id) VALUES (NEW.id, member_role);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER users_provision_member AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION provision_forum_member();
--> statement-breakpoint
INSERT INTO profiles (user_id, display_name, primary_role_id)
SELECT u.id, u.username, r.id FROM users u CROSS JOIN roles r WHERE r.key = 'member'
ON CONFLICT (user_id) DO NOTHING;
--> statement-breakpoint
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u CROSS JOIN roles r WHERE r.key = 'member'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Keep any real replies and references. Remove only records attributable to the old
-- synthetic importer (reserved ID + .invalid email + no authentication account).
CREATE TEMP TABLE imported_demo_users ON COMMIT DROP AS
SELECT id FROM users u WHERE id LIKE 'demo-member-%' AND email::text LIKE '%@demo.guildharbor.invalid'
AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.user_id = u.id);
--> statement-breakpoint
UPDATE posts SET deleted_at = now(), plain_text = '', content = '{"type":"doc","content":[]}' WHERE author_id IN (SELECT id FROM imported_demo_users);
--> statement-breakpoint
UPDATE threads SET title = 'Community discussion', slug = 'community-discussion',
  deleted_at = CASE WHEN EXISTS (SELECT 1 FROM posts p WHERE p.thread_id = threads.id AND p.deleted_at IS NULL) THEN NULL ELSE now() END
WHERE creator_id IN (SELECT id FROM imported_demo_users);
--> statement-breakpoint
DELETE FROM reputation_events WHERE reason = 'GuildHarbor demo reputation snapshot' AND giver_id IN (SELECT id FROM imported_demo_users) AND recipient_id IN (SELECT id FROM imported_demo_users);
--> statement-breakpoint
DELETE FROM vouches WHERE comment = 'GuildHarbor demo vouch snapshot' AND author_id IN (SELECT id FROM imported_demo_users) AND recipient_id IN (SELECT id FROM imported_demo_users);
--> statement-breakpoint
UPDATE users SET name = 'Deleted member', username = NULL, display_username = NULL, image = NULL, account_status = 'deleted', membership_status = 'rejected' WHERE id IN (SELECT id FROM imported_demo_users);
--> statement-breakpoint
UPDATE profiles SET display_name = NULL, avatar_url = NULL, banner_url = NULL, bio = '', signature = '{"type":"doc","content":[]}', reputation = 0, vouch_positive = 0, vouch_neutral = 0, vouch_negative = 0, like_count = 0, credit_balance = 0 WHERE user_id IN (SELECT id FROM imported_demo_users);
--> statement-breakpoint
-- Historical external/demo URLs are never used as private avatar URLs.
UPDATE profiles SET avatar_url = NULL WHERE avatar_url IS NOT NULL;
--> statement-breakpoint
UPDATE users SET image = NULL WHERE image IS NOT NULL;
--> statement-breakpoint
UPDATE threads t SET reply_count = greatest(0, (SELECT count(*)::int - 1 FROM posts p WHERE p.thread_id = t.id AND p.deleted_at IS NULL));
--> statement-breakpoint
UPDATE forums f SET thread_count = (SELECT count(*)::int FROM threads t WHERE t.forum_id = f.id AND t.deleted_at IS NULL), post_count = (SELECT count(*)::int FROM posts p JOIN threads t ON t.id = p.thread_id WHERE t.forum_id = f.id AND t.deleted_at IS NULL AND p.deleted_at IS NULL);
--> statement-breakpoint
UPDATE profiles pr SET thread_count = (SELECT count(*)::int FROM threads t WHERE t.creator_id = pr.user_id AND t.deleted_at IS NULL), post_count = (SELECT count(*)::int FROM posts p WHERE p.author_id = pr.user_id AND p.deleted_at IS NULL);
--> statement-breakpoint
-- Preserve former marketplace forum content as ordinary discussions.
UPDATE forums SET title = 'Community discussions' WHERE slug = 'marketplace';
--> statement-breakpoint
UPDATE categories SET title = 'Community discussions', description = 'Member discussions.' WHERE slug = 'marketplace';
