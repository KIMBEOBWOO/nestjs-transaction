import { MigrationInterface, QueryRunner } from 'typeorm';

export class Counters1700459336487 implements MigrationInterface {
  name = 'Counters1700459336487';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "counters" ("value" SERIAL NOT NULL, CONSTRAINT "PK_2dcce67f8560f77e18ae15f59ae" PRIMARY KEY ("value"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "counters"`);
  }
}
