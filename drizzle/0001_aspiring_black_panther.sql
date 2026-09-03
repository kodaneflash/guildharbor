ALTER TABLE "forums" ADD CONSTRAINT "forums_parent_forum_id_forums_id_fk" FOREIGN KEY ("parent_forum_id") REFERENCES "public"."forums"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION create_profile_for_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (user_id, display_name, joined_at, updated_at)
  VALUES (NEW.id, NEW.name, NEW.created_at, NOW())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS users_create_profile ON users;
--> statement-breakpoint
CREATE TRIGGER users_create_profile
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION create_profile_for_new_user();
