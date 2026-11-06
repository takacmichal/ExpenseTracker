import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { AuthResponse, UserProfile } from '../models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/users/me`;

  profile() {
    return this.http.get<UserProfile>(this.baseUrl);
  }

  updateProfile(name: string) {
    return this.http.put<UserProfile>(this.baseUrl, { name });
  }

  /**
   * Revokes the current token and returns a fresh session. A wrong current password comes
   * back as 400, not 401, so the session survives it.
   */
  changePassword(currentPassword: string, newPassword: string) {
    return this.http.post<AuthResponse>(`${this.baseUrl}/password`, {
      currentPassword,
      newPassword,
    });
  }

  deleteAccount(password: string) {
    return this.http.delete<void>(this.baseUrl, { body: { password } });
  }
}
