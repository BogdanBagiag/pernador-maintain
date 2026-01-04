import { Link } from 'react-router-dom'
import { Wrench, CheckCircle, Smartphone, BarChart3, Calendar, Users } from 'lucide-react'

export default function LandingPage() {
  const features = [
    {
      icon: CheckCircle,
      title: 'Work Order Management',
      description: 'Create, assign, and track maintenance work orders efficiently',
    },
    {
      icon: Calendar,
      title: 'Preventive Maintenance',
      description: 'Schedule and automate recurring maintenance tasks',
    },
    {
      icon: Wrench,
      title: 'Equipment Tracking',
      description: 'Complete registry of all your equipment and assets',
    },
    {
      icon: BarChart3,
      title: 'Reports & Analytics',
      description: 'Get insights with comprehensive reporting tools',
    },
    {
      icon: Smartphone,
      title: 'Mobile Ready',
      description: 'Access from any device, anywhere, anytime',
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Keep your entire team in sync and informed',
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Wrench className="w-8 h-8 text-primary-600" />
              <span className="text-2xl font-bold text-gray-900">Pernador Maintain</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/login" className="text-gray-700 hover:text-gray-900">
                Sign in
              </Link>
              <Link to="/register" className="btn-primary">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Streamline Your Equipment Maintenance
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              A powerful, easy-to-use maintenance management system designed to help you
              track equipment, manage work orders, and optimize your maintenance operations.
            </p>
            <Link to="/register" className="btn-primary text-lg px-8 py-3 inline-block">
              Start Free Trial
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything You Need
            </h2>
            <p className="text-xl text-gray-600">
              Powerful features to manage your maintenance operations
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="card hover:shadow-lg transition-shadow">
                <feature.icon className="w-12 h-12 text-primary-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Join companies that trust Pernador Maintain for their maintenance management
          </p>
          <Link to="/register" className="bg-white text-primary-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-block">
            Create Free Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-600">
            © 2025 Pernador Maintain. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
