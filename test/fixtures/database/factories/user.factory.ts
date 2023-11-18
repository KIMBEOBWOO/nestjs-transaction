import { setSeederFactory } from 'typeorm-extension';
import { User } from '../entities';

export default setSeederFactory(User, (faker) => {
  const user = new User();
  user.user_id = faker.internet.userName().slice(0, 20);
  user.password = faker.internet.password({
    length: 15,
  });
  user.email = faker.internet.email({});
  user.phone_number = faker.phone.number();

  return user;
});
