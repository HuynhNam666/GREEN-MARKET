document.addEventListener('DOMContentLoaded', () => {
  const app = window.GreenMarketApp;
  if (!app) return;

  const SOCIAL_LOADING_CLASS = 'opacity-75 pointer-events-none';
  let socialConfigPromise = null;
  let socialAuthInFlight = false;
  let googleHandlerRegistered = false;
  let facebookSdkPromise = null;

  const toggleButtons = Array.from(document.querySelectorAll('[data-toggle-password]'));
  toggleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.togglePassword);
      if (!input) return;
      const isPassword = input.getAttribute('type') === 'password';
      input.setAttribute('type', isPassword ? 'text' : 'password');
      const icon = button.querySelector('.material-symbols-outlined');
      if (icon) {
        icon.textContent = isPassword ? 'visibility_off' : 'visibility';
      }
    });
  });

  const applyAuthSession = async (authData, successMessage) => {
    const session = {
      token: authData.token,
      user: {
        id: authData.userId,
        username: authData.username,
        email: authData.email,
        role: authData.role,
      },
    };

    app.setSession(session);
    await app.refreshCurrentUser(true);
    app.notify(successMessage, 'success');

    const redirectTarget = app.getQueryParam('redirect');
    window.location.href = redirectTarget || app.buildPageUrl('taikhoan.html');
  };

  const loadScript = (src, id) => new Promise((resolve, reject) => {
    if (id) {
      const existing = document.getElementById(id);
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          resolve(existing);
          return;
        }
        existing.addEventListener('load', () => resolve(existing), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Không tải được script ${src}`)), { once: true });
        return;
      }
    }

    const script = document.createElement('script');
    if (id) script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve(script);
    };
    script.onerror = () => reject(new Error(`Không tải được script ${src}`));
    document.head.appendChild(script);
  });

  const getSocialConfig = async () => {
    if (!socialConfigPromise) {
      socialConfigPromise = app.request('/api/auth/external-config', {
        auth: false,
      }).catch((error) => {
        socialConfigPromise = null;
        throw error;
      });
    }

    return socialConfigPromise;
  };

  const setSocialButtonsBusy = (busy, provider) => {
    const buttons = Array.from(document.querySelectorAll(`[data-social-provider="${provider}"]`));
    buttons.forEach((button) => {
      button.disabled = busy;
      button.classList.toggle('opacity-75', busy);
      button.classList.toggle('pointer-events-none', busy);
      const label = button.querySelector('[data-social-label]');
      if (label) {
        label.textContent = busy
          ? (provider === 'facebook' ? 'Đang kết nối Facebook...' : 'Đang đăng nhập...')
          : (button.dataset.defaultLabel || label.textContent);
      }
    });
  };

  const showSocialUnavailable = (provider, message) => {
    const buttons = Array.from(document.querySelectorAll(`[data-social-provider="${provider}"]`));
    buttons.forEach((button) => {
      button.disabled = true;
      button.classList.add('opacity-60', 'cursor-not-allowed');
      const hint = button.querySelector('[data-social-hint]');
      if (hint) {
        hint.textContent = message;
      }
    });

    const slots = Array.from(document.querySelectorAll(`[data-social-slot="${provider}"]`));
    slots.forEach((slot) => {
      slot.innerHTML = `<div class="gm-social-disabled-note">${app.escapeHtml(message)}</div>`;
    });
  };

  const handleExternalLogin = async (provider, payload) => {
    if (socialAuthInFlight) return;
    socialAuthInFlight = true;
    setSocialButtonsBusy(true, provider);

    try {
      const path = provider === 'google' ? '/api/auth/google' : '/api/auth/facebook';
      const authData = await app.request(path, {
        method: 'POST',
        auth: false,
        body: payload,
      });

      await applyAuthSession(authData, `Đăng nhập ${provider === 'google' ? 'Google' : 'Facebook'} thành công.`);
    } catch (error) {
      app.notify(error.message || 'Đăng nhập mạng xã hội thất bại.', 'error');
    } finally {
      socialAuthInFlight = false;
      setSocialButtonsBusy(false, provider);
    }
  };

  const initializeGoogleLogin = async (config) => {
    const slots = Array.from(document.querySelectorAll('[data-social-slot="google"]'));
    if (!slots.length) return;

    if (!config?.googleEnabled || !config.googleClientId) {
      showSocialUnavailable('google', 'Google login chưa được cấu hình trong backend.');
      return;
    }

    try {
      await loadScript('https://accounts.google.com/gsi/client', 'gm-google-gsi');
      if (!window.google?.accounts?.id) {
        throw new Error('Google Identity Services chưa sẵn sàng.');
      }

      if (!googleHandlerRegistered) {
        window.google.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: async (response) => {
            if (!response?.credential) {
              app.notify('Không nhận được Google credential.', 'warning');
              return;
            }
            await handleExternalLogin('google', { credential: response.credential });
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        googleHandlerRegistered = true;
      }

      slots.forEach((slot) => {
        const wrapper = slot.closest('[data-social-provider="google"]');
        slot.innerHTML = '';
        const width = Math.min(Math.max(Math.round(slot.getBoundingClientRect().width || 320), 240), 380);
        window.google.accounts.id.renderButton(slot, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width,
          logo_alignment: 'left',
        });

        if (wrapper) {
          wrapper.classList.remove(SOCIAL_LOADING_CLASS);
        }
      });
    } catch (error) {
      console.warn(error);
      showSocialUnavailable('google', 'Không tải được Google Sign-In.');
    }
  };

  const ensureFacebookSdk = async (config) => {
    if (window.FB) return window.FB;
    if (facebookSdkPromise) return facebookSdkPromise;

    facebookSdkPromise = new Promise((resolve, reject) => {
      window.fbAsyncInit = () => {
        try {
          window.FB.init({
            appId: config.facebookAppId,
            cookie: true,
            xfbml: false,
            version: 'v25.0',
          });
          resolve(window.FB);
        } catch (error) {
          reject(error);
        }
      };

      loadScript('https://connect.facebook.net/en_US/sdk.js', 'gm-facebook-sdk').catch(reject);
    }).catch((error) => {
      facebookSdkPromise = null;
      throw error;
    });

    return facebookSdkPromise;
  };

  const initializeFacebookLogin = async (config) => {
    const buttons = Array.from(document.querySelectorAll('[data-social-provider="facebook"]'));
    if (!buttons.length) return;

    if (!config?.facebookEnabled || !config.facebookAppId) {
      showSocialUnavailable('facebook', 'Facebook login chưa được cấu hình trong backend.');
      return;
    }

    try {
      await ensureFacebookSdk(config);
      buttons.forEach((button) => {
        if (button.dataset.boundFacebook === 'true') return;
        button.dataset.boundFacebook = 'true';
        button.addEventListener('click', async () => {
          try {
            await ensureFacebookSdk(config);
            window.FB.login(async (response) => {
              const accessToken = response?.authResponse?.accessToken;
              if (!accessToken) {
                app.notify('Bạn đã hủy đăng nhập Facebook hoặc chưa cấp quyền email.', 'warning');
                return;
              }
              await handleExternalLogin('facebook', { accessToken });
            }, { scope: 'public_profile,email' });
          } catch (error) {
            app.notify(error.message || 'Không thể mở Facebook Login.', 'error');
          }
        });
      });
    } catch (error) {
      console.warn(error);
      showSocialUnavailable('facebook', 'Không tải được Facebook SDK.');
    }
  };

  const bootstrapSocialLogin = async () => {
    const hasSocialTargets = document.querySelector('[data-social-provider]') || document.querySelector('[data-social-slot]');
    if (!hasSocialTargets) return;

    try {
      const config = await getSocialConfig();
      await Promise.all([
        initializeGoogleLogin(config),
        initializeFacebookLogin(config),
      ]);
    } catch (error) {
      console.warn('Không tải được cấu hình social login:', error);
      app.notify('Không tải được cấu hình đăng nhập mạng xã hội.', 'warning');
    }
  };

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = document.getElementById('email')?.value.trim() || '';
      const password = document.getElementById('password')?.value || '';
      const submitButton = loginForm.querySelector('button[type="submit"]');
      const originalText = submitButton?.textContent || 'Đăng nhập';

      if (!email || !password) {
        app.notify('Vui lòng nhập email và mật khẩu.', 'warning');
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Đang đăng nhập...';
      }

      try {
        const authData = await app.request('/api/auth/login', {
          method: 'POST',
          auth: false,
          body: { email, password },
        });

        await applyAuthSession(authData, 'Đăng nhập thành công.');
      } catch (error) {
        app.notify(error.message, 'error');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalText;
        }
      }
    });
  }

  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const username = document.getElementById('register-username')?.value.trim() || '';
      const email = document.getElementById('register-email')?.value.trim() || '';
      const password = document.getElementById('register-password')?.value || '';
      const confirmPassword = document.getElementById('register-confirm-password')?.value || '';
      const role = document.getElementById('register-role')?.value || 'User';
      const termsChecked = document.getElementById('terms')?.checked;
      const submitButton = registerForm.querySelector('button[type="submit"]');
      const originalText = submitButton?.textContent || 'Đăng ký ngay';

      if (!username || !email || !password) {
        app.notify('Vui lòng nhập đầy đủ họ tên, email và mật khẩu.', 'warning');
        return;
      }

      if (password.length < 6) {
        app.notify('Mật khẩu cần có ít nhất 6 ký tự.', 'warning');
        return;
      }

      if (password !== confirmPassword) {
        app.notify('Mật khẩu xác nhận chưa khớp.', 'warning');
        return;
      }

      if (!termsChecked) {
        app.notify('Bạn cần đồng ý điều khoản để tiếp tục.', 'warning');
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Đang tạo tài khoản...';
      }

      try {
        await app.request('/api/auth/register', {
          method: 'POST',
          auth: false,
          body: { username, email, password, role },
        });

        app.notify('Đăng ký thành công. Mời bạn đăng nhập.', 'success');
        window.location.href = app.buildPageUrl('dangnhap.html', {
          redirect: app.buildPageUrl('taikhoan.html'),
        });
      } catch (error) {
        app.notify(error.message, 'error');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalText;
        }
      }
    });
  }

  bootstrapSocialLogin();
});
