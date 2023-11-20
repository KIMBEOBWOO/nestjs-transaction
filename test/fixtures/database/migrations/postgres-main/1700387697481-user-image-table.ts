import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserImageTable1700387697481 implements MigrationInterface {
  name = 'UserImageTable1700387697481';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_images" ("id" SERIAL NOT NULL, "userId" uuid, CONSTRAINT "PK_8c5d93e1b746bef23c0cf9aa3a6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_images" ADD CONSTRAINT "FK_e82761c6ff8ebd2e7c90958e87d" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_images" DROP CONSTRAINT "FK_e82761c6ff8ebd2e7c90958e87d"`,
    );
    await queryRunner.query(`DROP TABLE "user_images"`);
  }
}
