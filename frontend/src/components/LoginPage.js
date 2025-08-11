import React, { useState, useContext } from 'react';
import { AuthContext } from '../App';
import { MapPin, Lock, User, Mail, AlertCircle } from 'lucide-react';

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, register } = useContext(AuthContext);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (error) setError(''); // Clear error when user starts typing
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result;
      if (isLogin) {
        result = await login(formData.username, formData.password);
      } else {
        if (!formData.email) {
          setError('Email harus diisi');
          setLoading(false);
          return;
        }
        result = await register(formData.username, formData.email, formData.password);
      }

      if (!result.success) {
        setError(result.message);
      }
    } catch (error) {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setFormData({ username: '', email: '', password: '' });
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mb-4">
            <MapPin className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            GPS Tracking System
          </h1>
          <p className="text-white text-opacity-80">
            Sistem Monitoring dan Pelacakan GPS Real-time
          </p>
        </div>

        {/* Login/Register Form */}
        <div className="glass rounded-xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">
              {isLogin ? 'Masuk ke Akun' : 'Daftar Akun Baru'}
            </h2>
            <p className="text-white text-opacity-80">
              {isLogin 
                ? 'Masukkan kredensial Anda untuk melanjutkan' 
                : 'Buat akun baru untuk mulai tracking'
              }
            </p>
          </div>

          {error && (
            <div className="bg-danger-100 border border-danger-300 text-danger-800 px-4 py-3 rounded-lg mb-4 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Field */}
            <div className="form-group">
              <label className="form-label text-white">
                <User className="w-4 h-4 inline mr-2" />
                Username
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className="form-input bg-white bg-opacity-20 text-white placeholder-white placeholder-opacity-60 border-white border-opacity-30 focus:border-white focus:ring-white"
                placeholder="Masukkan username"
                required
              />
            </div>

            {/* Email Field - Only for Registration */}
            {!isLogin && (
              <div className="form-group">
                <label className="form-label text-white">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="form-input bg-white bg-opacity-20 text-white placeholder-white placeholder-opacity-60 border-white border-opacity-30 focus:border-white focus:ring-white"
                  placeholder="Masukkan email"
                  required={!isLogin}
                />
              </div>
            )}

            {/* Password Field */}
            <div className="form-group">
              <label className="form-label text-white">
                <Lock className="w-4 h-4 inline mr-2" />
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="form-input bg-white bg-opacity-20 text-white placeholder-white placeholder-opacity-60 border-white border-opacity-30 focus:border-white focus:ring-white"
                placeholder="Masukkan password"
                required
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-primary-600 py-3 px-4 rounded-lg font-semibold hover:bg-opacity-90 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="loading-spinner mr-2"></div>
                  Memproses...
                </>
              ) : (
                isLogin ? 'Masuk' : 'Daftar'
              )}
            </button>
          </form>

          {/* Toggle Mode */}
          <div className="text-center mt-6">
            <p className="text-white text-opacity-80">
              {isLogin ? 'Belum punya akun?' : 'Sudah punya akun?'}
              <button
                onClick={toggleMode}
                className="ml-2 text-white font-semibold hover:underline focus:outline-none"
              >
                {isLogin ? 'Daftar di sini' : 'Masuk di sini'}
              </button>
            </p>
          </div>
        </div>

        {/* Features Preview */}
        <div className="mt-8 text-center">
          <div className="grid grid-cols-3 gap-4 text-white text-opacity-80">
            <div className="text-center">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-2">
                <MapPin className="w-5 h-5" />
              </div>
              <p className="text-xs">Tracking Real-time</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-2">
                <Lock className="w-5 h-5" />
              </div>
              <p className="text-xs">Keamanan Data</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-2">
                <User className="w-5 h-5" />
              </div>
              <p className="text-xs">Dashboard Lengkap</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;