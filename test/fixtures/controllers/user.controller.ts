import { Controller, Post } from '@nestjs/common';
import { UserService } from '../services';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  createUser() {
    return this.userService.createUser();
  }
}
