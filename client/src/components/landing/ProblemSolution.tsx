import React from 'react';
import { AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';

export default function ProblemSolution() {
  const problems = [
    {
      icon: AlertCircle,
      title: 'Wasted Time',
      description: 'Hours spent on manual search and follow-up',
    },
    {
      icon: AlertCircle,
      title: 'Inconsistency',
      description: 'Non-uniform messages and random responses',
    },
    {
      icon: AlertCircle,
      title: 'Lost Opportunities',
      description: 'Unable to follow up with thousands of prospects',
    },
  ];

  const solutions = [
    {
      icon: CheckCircle,
      title: 'Smart Automation',
      description: 'Fully automated campaigns with human touch',
    },
    {
      icon: CheckCircle,
      title: 'Unified Messages',
      description: 'Custom templates personalized for each contact',
    },
    {
      icon: CheckCircle,
      title: 'Complete Control',
      description: 'Manage thousands of prospects effortlessly',
    },
  ];

  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            The Problem We Solve
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Managing LinkedIn relationships manually is exhausting and ineffective. Wassel transforms this challenge into a golden opportunity.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20">
          <div>
            <h3 className="text-2xl font-bold text-red-600 mb-8 flex items-center gap-2">
              <span className="text-3xl">❌</span>
              Before Wassel
            </h3>
            <div className="space-y-6">
              {problems.map((problem, index) => {
                const Icon = problem.icon;
                return (
                  <div key={index} className="flex gap-4">
                    <div className="flex-shrink-0">
                      <Icon size={24} className="text-red-600 mt-1" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">
                        {problem.title}
                      </h4>
                      <p className="text-gray-600">
                        {problem.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-2xl font-bold text-green-600 mb-8 flex items-center gap-2">
              <span className="text-3xl">✅</span>
              With Wassel
            </h3>
            <div className="space-y-6">
              {solutions.map((solution, index) => {
                const Icon = solution.icon;
                return (
                  <div key={index} className="flex gap-4">
                    <div className="flex-shrink-0">
                      <Icon size={24} className="text-green-600 mt-1" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">
                        {solution.title}
                      </h4>
                      <p className="text-gray-600">
                        {solution.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl p-12 text-center">
          <h3 className="text-3xl font-bold text-gray-900 mb-4">
            Result: 10x Productivity Increase
          </h3>
          <p className="text-lg text-gray-700 max-w-2xl mx-auto mb-8">
            Spend less time on manual management, focus on building real and valuable relationships.
          </p>
          <button className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all inline-flex items-center gap-2">
            Discover How It Works
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </section>
  );
}
