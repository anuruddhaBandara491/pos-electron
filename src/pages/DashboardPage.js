import React, { useState, useEffect } from 'react';
import '../styles/DashboardPage.css';

/**
 * Dashboard Page Component
 */
export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalSales: 0,
    totalOrders: 0,
    totalProducts: 0,
    cashBalance: 0
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);
        
        // Check if reports and orders API are available
        if (window.pos?.reports?.sales) {
          // Load dashboard statistics if API is available
          const salesReport = await window.pos.reports.sales({ limit: 1 });
          const ordersData = await window.pos.orders.getAll({ limit: 5 });

          setStats({
            totalSales: salesReport?.total_amount || 0,
            totalOrders: ordersData?.total || 0,
            totalProducts: 0,
            cashBalance: 0
          });
          setRecentOrders(ordersData?.data || []);
        } else {
          // Fallback: Show placeholder data when API isn't available
          console.log('Dashboard API not yet implemented - showing placeholder data');
          setStats({
            totalSales: 0,
            totalOrders: 0,
            totalProducts: 0,
            cashBalance: 0
          });
          setRecentOrders([]);
        }
      } catch (error) {
        console.error('Error loading dashboard:', error);
        // Set default values on error
        setStats({
          totalSales: 0,
          totalOrders: 0,
          totalProducts: 0,
          cashBalance: 0
        });
        setRecentOrders([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  return (
    <div className="dashboard-page">
      <h1>Dashboard</h1>

      {isLoading ? (
        <div className="loading">Loading dashboard...</div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Sales</h3>
              <p className="stat-value">${stats.totalSales.toFixed(2)}</p>
            </div>
            <div className="stat-card">
              <h3>Total Orders</h3>
              <p className="stat-value">{stats.totalOrders}</p>
            </div>
            <div className="stat-card">
              <h3>Products</h3>
              <p className="stat-value">{stats.totalProducts}</p>
            </div>
            <div className="stat-card">
              <h3>Cash Balance</h3>
              <p className="stat-value">${stats.cashBalance.toFixed(2)}</p>
            </div>
          </div>

          <div className="recent-orders">
            <h2>Recent Orders</h2>
            {recentOrders.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.id}</td>
                      <td>{new Date(order.created_at).toLocaleDateString()}</td>
                      <td>${order.total_amount.toFixed(2)}</td>
                      <td>
                        <span className={`status-badge status-${order.status}`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No recent orders</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
