import React, { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../App';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import { 
  MapPin, 
  Navigation, 
  Clock, 
  Gauge, 
  LogOut,
  Play,
  Square,
  AlertTriangle,
  User,
  Settings,
  Download,
  Plus,
  RefreshCw
} from 'lucide-react';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const Dashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const [gpsData, setGpsData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState('connecting');
  const [showGpsInput, setShowGpsInput] = useState(false);
  const [gpsInput, setGpsInput] = useState({
    device_id: 'MANUAL001',
    latitude: -6.2088,
    longitude: 106.8456,
    speed: 0,
    altitude: 0,
    heading: 0
  });

  const wsRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    initializeWebSocket();
    fetchLatestData();
    fetchHistory();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const initializeWebSocket = () => {
    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8001/api/ws';
    
    try {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setWsStatus('connected');
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'gps_update') {
            setGpsData(data.data);
            // Update history
            fetchHistory();
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setWsStatus('disconnected');
        // Reconnect after 3 seconds
        setTimeout(initializeWebSocket, 3000);
      };
      
      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsStatus('disconnected');
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setWsStatus('disconnected');
    }
  };

  const fetchLatestData = async () => {
    try {
      const response = await axios.get('/api/gps/latest/SIM001');
      setGpsData(response.data);
    } catch (error) {
      console.error('Failed to fetch latest GPS data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await axios.get('/api/gps/history/SIM001?limit=10');
      setHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch GPS history:', error);
    }
  };

  const handleGpsSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/gps', gpsInput);
      setShowGpsInput(false);
      // Reset form
      setGpsInput({
        device_id: 'MANUAL001',
        latitude: -6.2088,
        longitude: 106.8456,
        speed: 0,
        altitude: 0,
        heading: 0
      });
    } catch (error) {
      console.error('Failed to save GPS data:', error);
      alert('Gagal menyimpan data GPS. Silakan coba lagi.');
    }
  };

  const simulateGpsData = async () => {
    try {
      await axios.post('/api/gps/simulate');
    } catch (error) {
      console.error('Failed to simulate GPS data:', error);
      alert('Gagal membuat data simulasi. Silakan coba lagi.');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'diam': return 'text-gray-600 bg-gray-100';
      case 'bergerak': return 'text-success-600 bg-success-100';
      case 'overspeed': return 'text-danger-600 bg-danger-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'diam': return <Square className="w-4 h-4" />;
      case 'bergerak': return <Play className="w-4 h-4" />;
      case 'overspeed': return <AlertTriangle className="w-4 h-4" />;
      default: return <Square className="w-4 h-4" />;
    }
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Connection Status */}
      <div className={`connection-status ${wsStatus}`}>
        {wsStatus === 'connected' && '🟢 Terhubung'}
        {wsStatus === 'connecting' && '🟡 Menghubungkan...'}
        {wsStatus === 'disconnected' && '🔴 Terputus'}
      </div>

      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <MapPin className="w-8 h-8 text-primary-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">GPS Tracking System</h1>
                <p className="text-sm text-gray-500">Dashboard Monitoring</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={simulateGpsData}
                className="btn btn-secondary flex items-center"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Simulasi Data
              </button>
              <button
                onClick={() => setShowGpsInput(true)}
                className="btn btn-primary flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Input GPS
              </button>
              <div className="flex items-center space-x-2 text-gray-600">
                <User className="w-4 h-4" />
                <span className="text-sm">{user?.username}</span>
              </div>
              <button
                onClick={logout}
                className="btn btn-danger flex items-center"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Keluar
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Gauge className="w-8 h-8 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Kecepatan</p>
                <p className="text-2xl font-bold text-gray-900">
                  {gpsData?.speed?.toFixed(1) || '0.0'} <span className="text-sm text-gray-500">km/h</span>
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Navigation className="w-8 h-8 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Status</p>
                <div className={`status-badge ${getStatusColor(gpsData?.status)}`}>
                  {getStatusIcon(gpsData?.status)}
                  <span className="ml-1 capitalize">{gpsData?.status || 'Tidak Diketahui'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <MapPin className="w-8 h-8 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Koordinat</p>
                <p className="text-lg font-bold text-gray-900">
                  {gpsData ? `${gpsData.latitude.toFixed(6)}, ${gpsData.longitude.toFixed(6)}` : 'Tidak Ada Data'}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Clock className="w-8 h-8 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Update Terakhir</p>
                <p className="text-sm font-bold text-gray-900">
                  {gpsData ? formatDateTime(gpsData.timestamp) : 'Belum Ada Data'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Map and History */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Peta Real-time</h3>
              <div className="map-container">
                {gpsData ? (
                  <MapContainer
                    center={[gpsData.latitude, gpsData.longitude]}
                    zoom={15}
                    style={{ height: '100%', width: '100%' }}
                    ref={mapRef}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[gpsData.latitude, gpsData.longitude]}>
                      <Popup>
                        <div className="p-2">
                          <h4 className="font-semibold">Device: {gpsData.device_id}</h4>
                          <p className="text-sm">Kecepatan: {gpsData.speed.toFixed(1)} km/h</p>
                          <p className="text-sm">Status: {gpsData.status}</p>
                          <p className="text-sm">Update: {formatDateTime(gpsData.timestamp)}</p>
                        </div>
                      </Popup>
                    </Marker>
                  </MapContainer>
                ) : (
                  <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
                    <div className="text-center">
                      <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">Belum ada data GPS tersedia</p>
                      <button
                        onClick={simulateGpsData}
                        className="btn btn-primary mt-3"
                      >
                        Buat Data Simulasi
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* History */}
          <div className="lg:col-span-1">
            <div className="card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Riwayat Terakhir</h3>
                <button
                  onClick={fetchHistory}
                  className="btn btn-secondary btn-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {history.length > 0 ? history.map((item, index) => (
                  <div key={index} className="border-l-4 border-primary-500 pl-3 py-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {item.speed.toFixed(1)} km/h
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDateTime(item.timestamp)}
                        </p>
                      </div>
                      <span className={`status-badge text-xs ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
                    </p>
                  </div>
                )) : (
                  <div className="text-center py-8">
                    <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Belum ada riwayat</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* GPS Input Modal */}
      {showGpsInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="card max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Input Data GPS Manual</h3>
            <form onSubmit={handleGpsSubmit} className="space-y-4">
              <div>
                <label className="form-label">Device ID</label>
                <input
                  type="text"
                  value={gpsInput.device_id}
                  onChange={(e) => setGpsInput({...gpsInput, device_id: e.target.value})}
                  className="form-input"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={gpsInput.latitude}
                    onChange={(e) => setGpsInput({...gpsInput, latitude: parseFloat(e.target.value)})}
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={gpsInput.longitude}
                    onChange={(e) => setGpsInput({...gpsInput, longitude: parseFloat(e.target.value)})}
                    className="form-input"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="form-label">Kecepatan (km/h)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={gpsInput.speed}
                  onChange={(e) => setGpsInput({...gpsInput, speed: parseFloat(e.target.value)})}
                  className="form-input"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowGpsInput(false)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;